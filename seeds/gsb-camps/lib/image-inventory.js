const { MAX_SEED_IMAGE_COUNT, MIN_SEED_IMAGE_COUNT } = require('./constants');

const IMAGE_FILE_PATTERN = /\.(?:jpe?g|png)$/i;

function normalizeSourcePath(sourcePath) {
    return sourcePath.replaceAll('\\', '/');
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDuplicateImageFiles(imageFilenames, fileHashes) {
    const filesByHash = new Map();
    for (const filename of imageFilenames) {
        const hash = fileHashes[filename];
        if (!hash) continue;
        if (!filesByHash.has(hash)) filesByHash.set(hash, []);
        filesByHash.get(hash).push(filename);
    }
    return [...filesByHash.values()]
        .filter((files) => files.length > 1)
        .map((files) => files.sort())
        .sort((left, right) => left[0].localeCompare(right[0]));
}

function buildImageInventory(dataset, filenames, fileHashes = {}) {
    const imageFilenames = filenames.filter((filename) => IMAGE_FILE_PATTERN.test(filename));
    const duplicateImageFiles = findDuplicateImageFiles(imageFilenames, fileHashes);
    const requiresDocumentedSource = dataset.imageRightsDeclaration?.basis !== 'user-confirmed-reuse-no-attribution';
    const claimedFiles = new Set();
    const records = dataset.records.map((record) => {
        const expectedPattern = new RegExp(
            `^${escapeRegExp(record.seedKey)}-(0[1-${MAX_SEED_IMAGE_COUNT}])\\.(?:jpe?g|png)$`
        );
        const prefix = `${record.seedKey}-`;
        const candidateFiles = imageFilenames.filter((filename) => filename.startsWith(prefix));
        const discoveredFiles = candidateFiles.filter((filename) => expectedPattern.test(filename)).sort();
        candidateFiles.forEach((filename) => claimedFiles.add(filename));

        const configuredImages = new Map((record.sourceImages || []).map((sourceImage) => [
            normalizeSourcePath(sourceImage.sourcePath || ''),
            sourceImage
        ]));
        const problems = [];
        if (
            discoveredFiles.length < MIN_SEED_IMAGE_COUNT
            || discoveredFiles.length > MAX_SEED_IMAGE_COUNT
        ) {
            problems.push(
                `expected ${MIN_SEED_IMAGE_COUNT}-${MAX_SEED_IMAGE_COUNT} files; found ${discoveredFiles.length}`
            );
        }

        const indices = discoveredFiles.map((filename) => Number(expectedPattern.exec(filename)[1]));
        const expectedIndices = Array.from({ length: discoveredFiles.length }, (_, index) => index + 1);
        if (indices.some((value, index) => value !== expectedIndices[index])) {
            problems.push('image numbering must be contiguous starting at 01');
        }

        const files = discoveredFiles.map((filename) => {
            const sourcePath = `source-images/${filename}`;
            const configured = configuredImages.get(sourcePath);
            if (!configured) problems.push(`${sourcePath} is not listed in data/campgrounds.json`);
            else if (requiresDocumentedSource) {
                if (!configured.sourceUrl) problems.push(`${sourcePath} is missing sourceUrl`);
                if (!configured.attribution) problems.push(`${sourcePath} is missing attribution`);
            }
            return {
                sourcePath,
                configured: Boolean(configured),
                sourceUrl: configured?.sourceUrl || null,
                attribution: configured?.attribution || null
            };
        });

        for (const configuredPath of configuredImages.keys()) {
            if (configuredPath && !files.some((file) => file.sourcePath === configuredPath)) {
                problems.push(`${configuredPath} is listed but no matching file was found`);
            }
        }
        candidateFiles
            .filter((filename) => !discoveredFiles.includes(filename))
            .forEach((filename) => problems.push(`${filename} does not follow the required numbering format`));

        return {
            seedKey: record.seedKey,
            ready: problems.length === 0,
            files,
            problems: [...new Set(problems)],
            suggestedSourceImages: files
                .filter((file) => !file.configured)
                .map((file) => ({
                    sourcePath: file.sourcePath,
                    sourceUrl: null,
                    attribution: null
                }))
        };
    });

    return {
        ready: records.every((record) => record.ready) && duplicateImageFiles.length === 0,
        records,
        unrecognizedImageFiles: imageFilenames.filter((filename) => !claimedFiles.has(filename)).sort(),
        duplicateImageFiles
    };
}

module.exports = { buildImageInventory, findDuplicateImageFiles, normalizeSourcePath };
