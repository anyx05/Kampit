const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Campground = require('../../models/campgrounds');
const { AUTHOR_SEED_KEY, CLOUDINARY_FOLDER } = require('../../seeds/gsb-camps/lib/constants');
const { buildImageInventory } = require('../../seeds/gsb-camps/lib/image-inventory');
const { seedRecords } = require('../../seeds/gsb-camps/lib/runner');
const { analyzeDataset } = require('../../seeds/gsb-camps/lib/validation');
const { validateSeededRecords } = require('../../seeds/gsb-camps/lib/verification');

function validRecord(overrides = {}) {
    return {
        seedKey: 'gsb-test-camp',
        title: 'Reviewed Test Camp',
        location: 'Ankara, Türkiye',
        description: 'A reviewed description used only by the isolated seed unit tests.',
        price: 0,
        geometry: { type: 'Point', coordinates: [32.8597, 39.9334] },
        sourceUrls: ['https://example.org/official-camp-record'],
        sourceImages: [{
            sourcePath: 'source-images/gsb-test-camp-01.jpg',
            sourceUrl: 'https://example.org/official-image-page',
            attribution: 'Example owner, test fixture'
        }, {
            sourcePath: 'source-images/gsb-test-camp-02.png',
            sourceUrl: 'https://example.org/official-image-page-2',
            attribution: 'Example owner, second test fixture'
        }],
        verification: {
            identity: true,
            location: true,
            coordinates: true,
            content: true,
            pricing: true,
            imageRights: true
        },
        notes: 'Unit-test fixture only.',
        ...overrides
    };
}

async function validDataset(records = [validRecord()]) {
    const dataset = {
        dataset: 'gsb-camps',
        version: 'test-1',
        imageRightsDeclaration: {
            basis: 'documented-source',
            confirmedAt: '2026-07-17',
            confirmationNote: 'Unit-test fixture image rights declaration.'
        },
        records
    };
    const analysis = await analyzeDataset(dataset, { fileAccess: async () => {} });
    assert.equal(analysis.valid, true, JSON.stringify(analysis, null, 2));
    return { dataset, analysis };
}

function inMemoryRepository({ insertError } = {}) {
    const documents = [];
    let inserts = 0;
    return {
        documents,
        get inserts() { return inserts; },
        async findBySeedKey(seedKey) {
            return documents.find((document) => document.seedKey === seedKey) || null;
        },
        async findCollision({ title, location }) {
            return documents.find((document) => document.title === title && document.location === location) || null;
        },
        async insert(document) {
            inserts += 1;
            if (insertError) throw insertError;
            const saved = { ...document, _id: new mongoose.Types.ObjectId() };
            documents.push(saved);
            return saved;
        }
    };
}

function fakeCloudinary({ failUploadNumber, existing = false } = {}) {
    const uploads = [];
    const destroys = [];
    let uploadNumber = 0;
    return {
        uploads,
        destroys,
        api: {
            async resource(publicId) {
                if (existing) return { public_id: publicId, secure_url: `https://example.org/${publicId}.jpg` };
                throw Object.assign(new Error('not found'), { http_code: 404 });
            }
        },
        uploader: {
            async upload(sourcePath, options) {
                uploadNumber += 1;
                if (uploadNumber === failUploadNumber) throw new Error('Cloudinary upload failed');
                const publicId = `${options.folder}/${options.public_id}`;
                uploads.push({ sourcePath, publicId });
                return { public_id: publicId, secure_url: `https://example.org/${publicId}.jpg` };
            },
            async destroy(publicId) {
                destroys.push(publicId);
                return { result: 'ok' };
            }
        }
    };
}

test('GSB seeding is idempotent and does not upload again for an existing managed record', async () => {
    const { dataset, analysis } = await validDataset();
    const repository = inMemoryRepository();
    const cloudinaryClient = fakeCloudinary();
    const options = {
        dataset,
        analysis,
        authorId: new mongoose.Types.ObjectId(),
        dryRun: false,
        CampgroundModel: Campground,
        cloudinaryClient,
        repository
    };

    const first = await seedRecords(options);
    const second = await seedRecords(options);

    assert.equal(first[0].action, 'created');
    assert.equal(second[0].action, 'skipped-existing');
    assert.equal(repository.inserts, 1);
    assert.equal(cloudinaryClient.uploads.length, 2);
    assert.deepEqual(cloudinaryClient.destroys, []);
});

test('image inventory accepts two contiguous, attributed files using the stable naming convention', () => {
    const record = validRecord();
    const inventory = buildImageInventory(
        { records: [record] },
        ['test-camp-01.jpg', 'gsb-test-camp-01.jpg', 'gsb-test-camp-02.png', 'README.md']
    );

    assert.equal(inventory.ready, true);
    assert.deepEqual(inventory.unrecognizedImageFiles, ['test-camp-01.jpg']);
    assert.deepEqual(inventory.records[0].problems, []);
    assert.equal(inventory.records[0].files.length, 2);
});

test('image inventory accepts one reviewed image and rejects duplicate image contents', () => {
    const record = validRecord({ sourceImages: [validRecord().sourceImages[0]] });
    const singleImage = buildImageInventory(
        { records: [record] },
        ['gsb-test-camp-01.jpg'],
        { 'gsb-test-camp-01.jpg': 'unique-hash' }
    );
    assert.equal(singleImage.ready, true);

    const duplicateImages = buildImageInventory(
        { records: [validRecord()] },
        ['gsb-test-camp-01.jpg', 'gsb-test-camp-02.png'],
        {
            'gsb-test-camp-01.jpg': 'same-hash',
            'gsb-test-camp-02.png': 'same-hash'
        }
    );
    assert.equal(duplicateImages.ready, false);
    assert.deepEqual(duplicateImages.duplicateImageFiles, [[
        'gsb-test-camp-01.jpg',
        'gsb-test-camp-02.png'
    ]]);
});

test('an explicit reuse-without-attribution declaration permits private or attribution-free images', async () => {
    const dataset = {
        dataset: 'gsb-camps',
        version: 'test-rights-1',
        imageRightsDeclaration: {
            basis: 'user-confirmed-reuse-no-attribution',
            confirmedAt: '2026-07-17',
            confirmationNote: 'The project owner confirmed reuse rights for this fixture.'
        },
        records: [validRecord({
            sourceImages: [{
                sourcePath: 'source-images/gsb-test-camp-01.jpg',
                sourceUrl: null,
                attribution: null
            }]
        })]
    };

    const analysis = await analyzeDataset(dataset, { fileAccess: async () => {} });

    assert.equal(analysis.valid, true, JSON.stringify(analysis, null, 2));
    assert.equal(
        analysis.recordResults[0].resolvedSourceImages[0].rightsBasis,
        'user-confirmed-reuse-no-attribution'
    );
});

test('dry run reports planned inserts without writing to MongoDB or requiring Cloudinary', async () => {
    const { dataset, analysis } = await validDataset();
    const repository = inMemoryRepository();

    const results = await seedRecords({
        dataset,
        analysis,
        authorId: new mongoose.Types.ObjectId(),
        dryRun: true,
        CampgroundModel: Campground,
        repository
    });

    assert.deepEqual(results, [{ seedKey: 'gsb-test-camp', action: 'would-create' }]);
    assert.equal(repository.inserts, 0);
    assert.deepEqual(repository.documents, []);
});

test('Mongo insertion failure destroys the newly uploaded deterministic Cloudinary asset', async () => {
    const { dataset, analysis } = await validDataset();
    const repository = inMemoryRepository({ insertError: new Error('MongoDB insert failed') });
    const cloudinaryClient = fakeCloudinary();

    await assert.rejects(seedRecords({
        dataset,
        analysis,
        authorId: new mongoose.Types.ObjectId(),
        dryRun: false,
        CampgroundModel: Campground,
        cloudinaryClient,
        repository
    }), /MongoDB insert failed/);

    assert.equal(cloudinaryClient.uploads.length, 2);
    assert.deepEqual(cloudinaryClient.destroys, [
        `${CLOUDINARY_FOLDER}/gsb-test-camp-01`,
        `${CLOUDINARY_FOLDER}/gsb-test-camp-02`
    ]);
});

test('a later Cloudinary failure compensates earlier uploads in the same campground', async () => {
    const record = validRecord({
        sourceImages: [
            validRecord().sourceImages[0],
            {
                sourcePath: 'source-images/gsb-test-camp-02.png',
                sourceUrl: 'https://example.org/official-image-page-2',
                attribution: 'Example owner, second test fixture'
            }
        ]
    });
    const { dataset, analysis } = await validDataset([record]);
    const cloudinaryClient = fakeCloudinary({ failUploadNumber: 2 });

    await assert.rejects(seedRecords({
        dataset,
        analysis,
        authorId: new mongoose.Types.ObjectId(),
        dryRun: false,
        CampgroundModel: Campground,
        cloudinaryClient,
        repository: inMemoryRepository()
    }), /Cloudinary upload failed/);

    assert.deepEqual(cloudinaryClient.destroys, [`${CLOUDINARY_FOLDER}/gsb-test-camp-01`]);
});

test('an existing deterministic Cloudinary asset is reused and never compensated as a new upload', async () => {
    const { dataset, analysis } = await validDataset();
    const cloudinaryClient = fakeCloudinary({ existing: true });

    await assert.rejects(seedRecords({
        dataset,
        analysis,
        authorId: new mongoose.Types.ObjectId(),
        dryRun: false,
        CampgroundModel: Campground,
        cloudinaryClient,
        repository: inMemoryRepository({ insertError: new Error('MongoDB insert failed') })
    }), /MongoDB insert failed/);

    assert.deepEqual(cloudinaryClient.uploads, []);
    assert.deepEqual(cloudinaryClient.destroys, []);
});

test('seed verification checks exact records, deterministic Cloudinary metadata, and author ownership', async () => {
    const { dataset } = await validDataset();
    const authorId = new mongoose.Types.ObjectId();
    const record = validRecord();
    const storedRecord = {
        author: authorId,
        seedKey: record.seedKey,
        seedManaged: true,
        geometry: record.geometry,
        images: record.sourceImages.map((sourceImage, imageIndex) => ({
            filename: `${CLOUDINARY_FOLDER}/${record.seedKey}-${String(imageIndex + 1).padStart(2, '0')}`,
            url: `https://res.cloudinary.com/test/image/upload/${record.seedKey}-${imageIndex + 1}.jpg`
        })),
        seedMetadata: {
            dataset: dataset.dataset,
            version: dataset.version,
            imageSources: record.sourceImages,
            verification: record.verification
        }
    };

    const valid = validateSeededRecords({
        records: [storedRecord],
        dataset,
        seedAuthor: { _id: authorId, seedKey: AUTHOR_SEED_KEY }
    });
    assert.deepEqual(valid.missingSeedKeys, []);
    assert.deepEqual(valid.unexpectedSeedKeys, []);
    assert.deepEqual(valid.invalidGeometry, []);
    assert.deepEqual(valid.invalidImages, []);
    assert.deepEqual(valid.invalidMetadata, []);

    const invalid = validateSeededRecords({
        records: [{ ...storedRecord, images: [{ filename: 'wrong', url: 'http://example.com/image.jpg' }] }],
        dataset,
        seedAuthor: { _id: new mongoose.Types.ObjectId(), seedKey: AUTHOR_SEED_KEY }
    });
    assert.deepEqual(invalid.invalidImages, [record.seedKey]);
    assert.deepEqual(invalid.invalidMetadata, [record.seedKey]);
});
