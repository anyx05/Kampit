const Campground = require('../../../models/campgrounds');
const { CLOUDINARY_FOLDER } = require('./constants');
const { buildSeedDocument, expectedPublicId } = require('./validation');

function defaultCampgroundRepository(CampgroundModel) {
    return {
        findBySeedKey: (seedKey) => CampgroundModel.findOne({ seedKey }).lean(),
        findCollision: ({ title, location }) => CampgroundModel.findOne({ title, location }).lean(),
        insert: async (document) => new CampgroundModel(document).save()
    };
}

function cloudinaryNotFound(error) {
    return (
        error?.http_code === 404
        || error?.statusCode === 404
        || error?.error?.http_code === 404
    );
}

async function findCloudinaryImage(cloudinaryClient, publicId) {
    try {
        const resource = await cloudinaryClient.api.resource(publicId, { resource_type: 'image' });
        if (!resource?.secure_url) throw new Error(`Cloudinary resource ${publicId} has no secure URL`);
        return { filename: publicId, url: resource.secure_url, newlyUploaded: false };
    } catch (error) {
        if (cloudinaryNotFound(error)) return null;
        throw error;
    }
}

async function uploadCloudinaryImage(cloudinaryClient, record, sourceImage, imageIndex) {
    const publicId = expectedPublicId(record.seedKey, imageIndex);
    const existing = await findCloudinaryImage(cloudinaryClient, publicId);
    if (existing) return existing;

    const context = {
        seed_key: record.seedKey,
        rights_basis: sourceImage.rightsBasis
    };
    if (sourceImage.attribution) context.attribution = sourceImage.attribution;
    if (sourceImage.sourceUrl) context.source_url = sourceImage.sourceUrl;

    const result = await cloudinaryClient.uploader.upload(sourceImage.resolvedPath, {
        folder: CLOUDINARY_FOLDER,
        public_id: `${record.seedKey}-${String(imageIndex + 1).padStart(2, '0')}`,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        context
    });

    if (result?.public_id !== publicId || !result?.secure_url) {
        const error = new Error(`Cloudinary returned an unexpected identifier or URL for ${publicId}`);
        error.newlyUploadedPublicId = result?.public_id;
        throw error;
    }
    return { filename: result.public_id, url: result.secure_url, newlyUploaded: true };
}

async function destroyUploadedImages(cloudinaryClient, publicIds) {
    // Callers pass only public IDs returned by uploads made in the current attempt.
    // If Cloudinary unexpectedly places one outside the requested folder, it is still
    // that attempt's asset and must be compensated rather than orphaned.
    const safeIds = [...new Set(publicIds)].filter((publicId) => (
        typeof publicId === 'string' && publicId.length > 0
    ));
    const results = await Promise.allSettled(
        safeIds.map((publicId) => cloudinaryClient.uploader.destroy(publicId, { resource_type: 'image' }))
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) {
        throw new AggregateError(
            failures.map((result) => result.reason),
            `Failed to compensate ${failures.length} newly uploaded seed image(s)`
        );
    }
}

async function createCampground(record, options) {
    const {
        authorId,
        CampgroundModel,
        cloudinaryClient,
        datasetVersion,
        now,
        repository,
        resolvedSourceImages
    } = options;
    const images = [];
    const newlyUploaded = [];

    try {
        for (const [imageIndex, sourceImage] of resolvedSourceImages.entries()) {
            let uploaded;
            try {
                uploaded = await uploadCloudinaryImage(cloudinaryClient, record, sourceImage, imageIndex);
            } catch (error) {
                if (error.newlyUploadedPublicId) newlyUploaded.push(error.newlyUploadedPublicId);
                throw error;
            }
            images.push({ filename: uploaded.filename, url: uploaded.url });
            if (uploaded.newlyUploaded) newlyUploaded.push(uploaded.filename);
        }

        const document = buildSeedDocument(record, {
            authorId,
            datasetVersion,
            imageRightsDeclaration: options.imageRightsDeclaration,
            images,
            now
        });
        await new CampgroundModel(document).validate();
        return await repository.insert(document);
    } catch (error) {
        try {
            await destroyUploadedImages(cloudinaryClient, newlyUploaded);
        } catch (cleanupError) {
            error.cleanupError = cleanupError;
        }
        throw error;
    }
}

async function seedRecords(options) {
    const {
        dataset,
        analysis,
        authorId,
        dryRun,
        CampgroundModel = Campground,
        cloudinaryClient,
        repository = defaultCampgroundRepository(CampgroundModel),
        now = new Date()
    } = options;

    if (!analysis?.valid) throw new Error('Refusing to seed a dataset that did not pass validation');
    if (!dryRun && !cloudinaryClient) throw new Error('Cloudinary client is required in execute mode');

    const results = [];
    for (const [recordIndex, record] of dataset.records.entries()) {
        const existing = await repository.findBySeedKey(record.seedKey);
        if (existing) {
            if (existing.seedManaged !== true) {
                throw new Error(`Refusing to modify unmanaged campground with seedKey ${record.seedKey}`);
            }
            results.push({ seedKey: record.seedKey, action: 'skipped-existing', id: existing._id });
            continue;
        }

        const collision = await repository.findCollision(record);
        if (collision) {
            throw new Error(
                `Refusing to create ${record.seedKey}; title and location collide with campground ${collision._id}`
            );
        }

        if (dryRun) {
            results.push({ seedKey: record.seedKey, action: 'would-create' });
            continue;
        }

        const created = await createCampground(record, {
            authorId,
            CampgroundModel,
            cloudinaryClient,
            datasetVersion: dataset.version,
            imageRightsDeclaration: dataset.imageRightsDeclaration,
            now,
            repository,
            resolvedSourceImages: analysis.recordResults[recordIndex].resolvedSourceImages
        });
        results.push({ seedKey: record.seedKey, action: 'created', id: created._id });
    }

    return results;
}

module.exports = {
    createCampground,
    findCloudinaryImage,
    seedRecords,
    uploadCloudinaryImage
};
