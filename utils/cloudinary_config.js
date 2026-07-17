const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { ExpressError } = require('./errorHandler');

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const ALLOWED_CLOUDINARY_FORMATS = ['jpg', 'jpeg', 'png'];

cloudinary.config({
    cloud_name: process.env.CLOUDNAME,
    api_key: process.env.CLOUDINARYKEY,
    api_secret: process.env.CLOUDINARYSECRET
});

const imageFileFilter = (req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        return callback(new ExpressError('Images must be JPEG or PNG files.', 400));
    }
    callback(null, true);
};

// Keep multipart files in memory so normal form fields can be validated before
// any external Cloudinary write is started.
const multipartParser = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
        files: MAX_IMAGE_COUNT
    }
}).array('image', MAX_IMAGE_COUNT);

const uploadCampgroundImages = (req, res, next) => {
    multipartParser(req, res, (error) => {
        if (!error) return next();

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return next(new ExpressError('Each image must be 5 MB or smaller.', 413));
            }
            if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
                return next(new ExpressError(`A campground can have at most ${MAX_IMAGE_COUNT} images.`, 400));
            }
        }

        next(error);
    });
};

const uploadImage = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
        folder: 'Kampit',
        resource_type: 'image',
        allowed_formats: ALLOWED_CLOUDINARY_FORMATS
    }, (error, result) => {
        if (error) return reject(error);
        resolve({ filename: result.public_id, url: result.secure_url });
    });

    stream.end(file.buffer);
});

const uniqueFilenames = (imagesOrFilenames = []) => [...new Set(
    imagesOrFilenames
        .map((image) => typeof image === 'string' ? image : image?.filename)
        .filter((filename) => typeof filename === 'string' && filename.length > 0)
)];

const destroyImages = async (imagesOrFilenames) => {
    const results = await Promise.allSettled(
        uniqueFilenames(imagesOrFilenames).map((filename) => cloudinary.uploader.destroy(filename))
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) {
        throw new AggregateError(
            failures.map((result) => result.reason),
            `Failed to delete ${failures.length} Cloudinary image(s).`
        );
    }
};

const uploadImages = async (files = []) => {
    const results = await Promise.allSettled(files.map(uploadImage));
    const uploadedImages = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
    const failedUpload = results.find((result) => result.status === 'rejected');

    if (failedUpload) {
        try {
            await destroyImages(uploadedImages);
        } catch (cleanupError) {
            failedUpload.reason.cleanupError = cleanupError;
        }
        throw failedUpload.reason;
    }

    return uploadedImages;
};

module.exports = {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_COUNT,
    MAX_IMAGE_SIZE_BYTES,
    cloudinary,
    destroyImages,
    uploadCampgroundImages,
    uploadImages
};
