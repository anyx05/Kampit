const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const Campground = require('../../../models/campgrounds');
const {
    CLOUDINARY_FOLDER,
    DATASET_NAME,
    MAX_SEED_IMAGE_COUNT,
    MIN_SEED_IMAGE_COUNT,
    SEED_ROOT,
    VERIFICATION_FIELDS
} = require('./constants');

const SEED_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png)$/i;
const TURKIYE_BOUNDS = Object.freeze({
    minLongitude: 25.5,
    maxLongitude: 45,
    minLatitude: 35.5,
    maxLatitude: 42.5
});
const MAX_SOURCE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_RIGHTS_BASES = Object.freeze([
    'documented-source',
    'user-confirmed-reuse-no-attribution'
]);

async function checkSourceFile(sourcePath) {
    const stats = await fs.stat(sourcePath);
    if (!stats.isFile()) throw new Error('sourcePath must reference a file');
    if (stats.size > MAX_SOURCE_IMAGE_SIZE_BYTES) throw new Error('source image must be 5 MB or smaller');
}

function expectedPublicId(seedKey, imageIndex) {
    return `${CLOUDINARY_FOLDER}/${seedKey}-${String(imageIndex + 1).padStart(2, '0')}`;
}

function isHttpsUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function resolveSourcePath(sourcePath, seedRoot = SEED_ROOT) {
    if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
        throw new Error('sourcePath is required');
    }

    const root = path.resolve(seedRoot);
    const resolved = path.resolve(root, sourcePath);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('sourcePath must stay inside the gsb-camps seed directory');
    }
    return resolved;
}

function mongooseMessages(error) {
    if (!error?.errors) return [error.message];
    return Object.values(error.errors).map((item) => `${item.path}: ${item.message}`);
}

function buildSeedDocument(record, {
    authorId,
    datasetVersion,
    imageRightsDeclaration,
    images,
    now = new Date()
}) {
    return {
        title: record.title,
        images,
        price: record.price,
        description: record.description,
        location: record.location,
        geometry: record.geometry,
        reviews: [],
        author: authorId,
        seedKey: record.seedKey,
        seedManaged: true,
        seedMetadata: {
            dataset: DATASET_NAME,
            version: datasetVersion,
            sourceUrls: record.sourceUrls,
            imageSources: record.sourceImages,
            imageRightsDeclaration,
            verification: record.verification,
            notes: record.notes,
            lastSeededAt: now
        }
    };
}

function placeholderImages(record) {
    return (record.sourceImages || []).map((sourceImage, imageIndex) => ({
        filename: expectedPublicId(record.seedKey, imageIndex),
        url: `https://pending.invalid/${encodeURIComponent(record.seedKey)}-${imageIndex + 1}.jpg`
    }));
}

function validateGeometry(record, problems) {
    const geometry = record.geometry;
    if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return;
    if (geometry.coordinates.length !== 2 || !geometry.coordinates.every(Number.isFinite)) return;

    const [longitude, latitude] = geometry.coordinates;
    if (
        longitude < TURKIYE_BOUNDS.minLongitude
        || longitude > TURKIYE_BOUNDS.maxLongitude
        || latitude < TURKIYE_BOUNDS.minLatitude
        || latitude > TURKIYE_BOUNDS.maxLatitude
    ) {
        problems.push('geometry coordinates are valid GeoJSON but outside the configured Türkiye review bounds');
    }
}

async function validateSourceImages(record, problems, {
    seedRoot,
    fileAccess,
    imageRightsDeclaration
}) {
    if (!Array.isArray(record.sourceImages) || record.sourceImages.length < MIN_SEED_IMAGE_COUNT) {
        problems.push(`between ${MIN_SEED_IMAGE_COUNT} and ${MAX_SEED_IMAGE_COUNT} reviewed source images are required`);
        if (!Array.isArray(record.sourceImages)) return [];
    }
    if (record.sourceImages.length > MAX_SEED_IMAGE_COUNT) {
        problems.push(`no more than ${MAX_SEED_IMAGE_COUNT} source images are allowed`);
    }
    if (record.sourceImages.length === 0) {
        return [];
    }

    const resolvedSourceImages = [];
    for (const [imageIndex, sourceImage] of record.sourceImages.entries()) {
        const label = `sourceImages[${imageIndex}]`;
        let resolvedPath;
        try {
            resolvedPath = resolveSourcePath(sourceImage?.sourcePath, seedRoot);
            if (!IMAGE_EXTENSION_PATTERN.test(resolvedPath)) {
                problems.push(`${label}.sourcePath must reference a JPEG or PNG file`);
            }
            const expectedStem = `${record.seedKey}-${String(imageIndex + 1).padStart(2, '0')}`;
            const filename = path.basename(resolvedPath).toLowerCase();
            if (!['.jpg', '.jpeg', '.png'].some((extension) => filename === `${expectedStem}${extension}`)) {
                problems.push(`${label}.sourcePath filename must be ${expectedStem}.jpg, .jpeg, or .png`);
            }
            await fileAccess(resolvedPath);
        } catch (error) {
            problems.push(`${label}.sourcePath: ${error.message}`);
        }

        const hasSourceUrl = sourceImage?.sourceUrl !== null && sourceImage?.sourceUrl !== undefined;
        const hasAttribution = sourceImage?.attribution !== null && sourceImage?.attribution !== undefined;
        if (hasSourceUrl && !isHttpsUrl(sourceImage.sourceUrl)) {
            problems.push(`${label}.sourceUrl must be a valid HTTPS provenance URL when provided`);
        }
        if (hasAttribution && (
            typeof sourceImage.attribution !== 'string'
            || sourceImage.attribution.trim() === ''
        )) {
            problems.push(`${label}.attribution must be a non-empty string when provided`);
        }
        if (imageRightsDeclaration?.basis === 'documented-source') {
            if (!hasSourceUrl) problems.push(`${label}.sourceUrl is required for documented-source images`);
            if (!hasAttribution) problems.push(`${label}.attribution is required for documented-source images`);
        }

        resolvedSourceImages.push({
            ...sourceImage,
            resolvedPath,
            rightsBasis: imageRightsDeclaration?.basis
        });
    }
    return resolvedSourceImages;
}

async function validateSeedRecord(record, options = {}) {
    const {
        authorId = new mongoose.Types.ObjectId(),
        CampgroundModel = Campground,
        datasetVersion = 'unversioned',
        imageRightsDeclaration,
        seedRoot = SEED_ROOT,
        fileAccess = checkSourceFile
    } = options;
    const problems = [];

    if (!SEED_KEY_PATTERN.test(record?.seedKey || '')) {
        problems.push('seedKey must be a lowercase, hyphen-delimited stable identifier');
    }
    if (!Array.isArray(record?.sourceUrls) || record.sourceUrls.length === 0) {
        problems.push('at least one current official source URL is required');
    } else {
        record.sourceUrls.forEach((sourceUrl, sourceIndex) => {
            if (!isHttpsUrl(sourceUrl)) problems.push(`sourceUrls[${sourceIndex}] must be a valid HTTPS URL`);
        });
    }

    for (const field of VERIFICATION_FIELDS) {
        if (record?.verification?.[field] !== true) problems.push(`verification.${field} must be explicitly approved`);
    }

    validateGeometry(record, problems);
    const resolvedSourceImages = await validateSourceImages(record, problems, {
        seedRoot,
        fileAccess,
        imageRightsDeclaration
    });

    const document = buildSeedDocument(record, {
        authorId,
        datasetVersion,
        imageRightsDeclaration,
        images: placeholderImages(record)
    });
    try {
        await new CampgroundModel(document).validate();
    } catch (error) {
        problems.push(...mongooseMessages(error).map((message) => `schema: ${message}`));
    }

    return {
        seedKey: record?.seedKey || '<missing-seed-key>',
        valid: problems.length === 0,
        problems: [...new Set(problems)],
        resolvedSourceImages
    };
}

async function analyzeDataset(dataset, options = {}) {
    const globalProblems = [];
    if (dataset?.dataset !== DATASET_NAME) globalProblems.push(`dataset must equal ${DATASET_NAME}`);
    if (typeof dataset?.version !== 'string' || dataset.version.trim() === '') {
        globalProblems.push('dataset version is required');
    }
    if (!Array.isArray(dataset?.records) || dataset.records.length === 0) {
        globalProblems.push('dataset records must be a non-empty array');
    }
    const imageRightsDeclaration = dataset?.imageRightsDeclaration;
    if (!IMAGE_RIGHTS_BASES.includes(imageRightsDeclaration?.basis)) {
        globalProblems.push(`imageRightsDeclaration.basis must be one of: ${IMAGE_RIGHTS_BASES.join(', ')}`);
    }
    if (Number.isNaN(Date.parse(imageRightsDeclaration?.confirmedAt || ''))) {
        globalProblems.push('imageRightsDeclaration.confirmedAt must be a valid date');
    }
    if (
        typeof imageRightsDeclaration?.confirmationNote !== 'string'
        || imageRightsDeclaration.confirmationNote.trim() === ''
    ) {
        globalProblems.push('imageRightsDeclaration.confirmationNote is required');
    }

    const records = Array.isArray(dataset?.records) ? dataset.records : [];
    const counts = new Map();
    records.forEach((record) => counts.set(record?.seedKey, (counts.get(record?.seedKey) || 0) + 1));
    for (const [seedKey, count] of counts) {
        if (count > 1) globalProblems.push(`duplicate dataset seedKey: ${seedKey}`);
    }

    const recordResults = await Promise.all(records.map((record) => validateSeedRecord(record, {
        ...options,
        datasetVersion: dataset.version,
        imageRightsDeclaration
    })));

    return {
        valid: globalProblems.length === 0 && recordResults.every((record) => record.valid),
        globalProblems,
        recordResults
    };
}

function formatAnalysis(analysis) {
    const lines = [];
    analysis.globalProblems.forEach((problem) => lines.push(`dataset: ${problem}`));
    analysis.recordResults.forEach((record) => {
        if (record.valid) return;
        lines.push(`${record.seedKey}:`);
        record.problems.forEach((problem) => lines.push(`  - ${problem}`));
    });
    return lines.join('\n');
}

module.exports = {
    MAX_SOURCE_IMAGE_SIZE_BYTES,
    IMAGE_RIGHTS_BASES,
    TURKIYE_BOUNDS,
    analyzeDataset,
    buildSeedDocument,
    expectedPublicId,
    formatAnalysis,
    resolveSourcePath,
    validateSeedRecord
};
