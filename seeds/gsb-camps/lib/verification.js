const {
    AUTHOR_SEED_KEY,
    CLOUDINARY_FOLDER,
    DATASET_NAME,
    MAX_SEED_IMAGE_COUNT,
    MIN_SEED_IMAGE_COUNT,
    VERIFICATION_FIELDS
} = require('./constants');
const { expectedPublicId } = require('./validation');

async function duplicateSeedKeys(Model) {
    return Model.aggregate([
        { $match: { seedKey: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$seedKey', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { _id: 1 } }
    ]);
}

function validPoint(geometry) {
    if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return false;
    const [longitude, latitude] = geometry.coordinates;
    return (
        geometry.coordinates.length === 2
        && Number.isFinite(longitude)
        && Number.isFinite(latitude)
        && longitude >= -180
        && longitude <= 180
        && latitude >= -90
        && latitude <= 90
    );
}

function validCloudinaryImage(image, seedKey, imageIndex) {
    if (image?.filename !== expectedPublicId(seedKey, imageIndex)) return false;
    if (!image.filename.startsWith(`${CLOUDINARY_FOLDER}/`)) return false;
    try {
        const url = new URL(image.url);
        return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
    } catch {
        return false;
    }
}

function validateSeededRecords({ records, dataset, seedAuthor }) {
    const expectedRecords = Array.isArray(dataset?.records) ? dataset.records : [];
    const expectedByKey = new Map(expectedRecords.map((record) => [record.seedKey, record]));
    const actualByKey = new Map(records.map((record) => [record.seedKey, record]));
    const missingSeedKeys = [...expectedByKey.keys()].filter((key) => !actualByKey.has(key));
    const unexpectedSeedKeys = [...actualByKey.keys()].filter((key) => !expectedByKey.has(key));
    const invalidGeometry = [];
    const invalidImages = [];
    const invalidMetadata = [];

    for (const [seedKey, expected] of expectedByKey) {
        const record = actualByKey.get(seedKey);
        if (!record) continue;

        if (!validPoint(record.geometry)) invalidGeometry.push(seedKey);

        const images = Array.isArray(record.images) ? record.images : [];
        const expectedImageCount = expected.sourceImages?.length || 0;
        if (
            images.length !== expectedImageCount
            || images.length < MIN_SEED_IMAGE_COUNT
            || images.length > MAX_SEED_IMAGE_COUNT
            || images.some((image, imageIndex) => !validCloudinaryImage(image, seedKey, imageIndex))
        ) {
            invalidImages.push(seedKey);
        }

        const metadata = record.seedMetadata;
        const authorMatches = seedAuthor?._id && String(record.author) === String(seedAuthor._id);
        const verificationComplete = VERIFICATION_FIELDS.every(
            (field) => metadata?.verification?.[field] === true
        );
        if (
            record.seedManaged !== true
            || !authorMatches
            || metadata?.dataset !== DATASET_NAME
            || metadata?.version !== dataset.version
            || metadata?.imageSources?.length !== expectedImageCount
            || !verificationComplete
        ) {
            invalidMetadata.push(seedKey);
        }
    }

    return {
        expectedSeededCampgrounds: expectedRecords.length,
        seededCampgrounds: records.length,
        seedAuthorPresent: Boolean(seedAuthor),
        missingSeedKeys,
        unexpectedSeedKeys,
        invalidGeometry,
        invalidImages,
        invalidMetadata
    };
}

async function buildVerificationReport({ User, Campground, Review, dataset }) {
    const [
        users,
        campgrounds,
        reviews,
        recordsMissingImages,
        recordsMissingGeometry,
        duplicateCampgroundSeedKeys,
        duplicateUserSeedKeys,
        seedAuthor,
        seededRecords
    ] = await Promise.all([
        User.countDocuments({}),
        Campground.countDocuments({}),
        Review.countDocuments({}),
        Campground.countDocuments({ $or: [
            { images: { $exists: false } },
            { 'images.0': { $exists: false } }
        ] }),
        Campground.countDocuments({ $or: [
            { geometry: { $exists: false } },
            { 'geometry.type': { $exists: false } },
            { 'geometry.coordinates.0': { $exists: false } },
            { 'geometry.coordinates.1': { $exists: false } }
        ] }),
        duplicateSeedKeys(Campground),
        duplicateSeedKeys(User),
        User.findOne({ seedKey: AUTHOR_SEED_KEY, seedManaged: true }).select('_id seedKey').lean(),
        Campground.find({ seedManaged: true, 'seedMetadata.dataset': DATASET_NAME })
            .select('author geometry images seedKey seedManaged seedMetadata')
            .sort({ seedKey: 1 })
            .lean()
    ]);

    const seedDataset = validateSeededRecords({ records: seededRecords, dataset, seedAuthor });
    const report = {
        users,
        campgrounds,
        reviews,
        recordsMissingImages,
        recordsMissingGeometry,
        duplicateSeedKeys: {
            campgrounds: duplicateCampgroundSeedKeys,
            users: duplicateUserSeedKeys
        },
        seedDataset
    };
    report.ready = (
        recordsMissingImages === 0
        && recordsMissingGeometry === 0
        && duplicateCampgroundSeedKeys.length === 0
        && duplicateUserSeedKeys.length === 0
        && seedDataset.seedAuthorPresent
        && seedDataset.seededCampgrounds === seedDataset.expectedSeededCampgrounds
        && seedDataset.missingSeedKeys.length === 0
        && seedDataset.unexpectedSeedKeys.length === 0
        && seedDataset.invalidGeometry.length === 0
        && seedDataset.invalidImages.length === 0
        && seedDataset.invalidMetadata.length === 0
    );
    return report;
}

module.exports = {
    buildVerificationReport,
    duplicateSeedKeys,
    validateSeededRecords,
    validCloudinaryImage,
    validPoint
};
