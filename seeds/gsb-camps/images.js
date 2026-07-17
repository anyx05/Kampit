const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const path = require('node:path');
const dataset = require('./data/campgrounds.json');
const { SEED_ROOT } = require('./lib/constants');
const { buildImageInventory } = require('./lib/image-inventory');

async function main() {
    const sourceDirectory = path.join(SEED_ROOT, 'source-images');
    const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
    const filenames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const imageFilenames = filenames.filter((filename) => /\.(?:jpe?g|png)$/i.test(filename));
    const fileHashes = Object.fromEntries(await Promise.all(imageFilenames.map(async (filename) => {
        const contents = await fs.readFile(path.join(sourceDirectory, filename));
        return [filename, crypto.createHash('sha256').update(contents).digest('hex')];
    })));
    const inventory = buildImageInventory(dataset, filenames, fileHashes);
    console.log(JSON.stringify(inventory, null, 2));
    if (!inventory.ready || inventory.unrecognizedImageFiles.length) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Seed image inventory failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { main };
