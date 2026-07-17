const path = require('node:path');

const AUTHOR_SEED_KEY = 'gsb-camps-seed-author';
const CLOUDINARY_FOLDER = 'kampit/seed/gsb-camps';
const DATABASE_NAME = 'Kampit';
const DATASET_NAME = 'gsb-camps';
const EXECUTE_CONFIRMATION = `${DATABASE_NAME}/${DATASET_NAME}`;
const MAX_SEED_IMAGE_COUNT = 4;
const MIN_SEED_IMAGE_COUNT = 1;
const PRODUCTION_CONFIRMATION = `${EXECUTE_CONFIRMATION}/production`;
const SEED_ROOT = path.resolve(__dirname, '..');
const VERIFICATION_FIELDS = Object.freeze([
    'identity',
    'location',
    'coordinates',
    'content',
    'pricing',
    'imageRights'
]);

module.exports = {
    AUTHOR_SEED_KEY,
    CLOUDINARY_FOLDER,
    DATABASE_NAME,
    DATASET_NAME,
    EXECUTE_CONFIRMATION,
    MAX_SEED_IMAGE_COUNT,
    MIN_SEED_IMAGE_COUNT,
    PRODUCTION_CONFIRMATION,
    SEED_ROOT,
    VERIFICATION_FIELDS
};
