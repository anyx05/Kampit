
const Campground = require('../models/campgrounds');
const cloudinaryImages = require('../utils/cloudinary_config');
const { ExpressError } = require('../utils/errorHandler');
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });

const EDITABLE_CAMPGROUND_FIELDS = ['title', 'price', 'description', 'location'];

const editableCampgroundFields = (input = {}) => Object.fromEntries(
    EDITABLE_CAMPGROUND_FIELDS
        .filter((field) => Object.prototype.hasOwnProperty.call(input, field))
        .map((field) => [field, input[field]])
);

const asArray = (value) => value === undefined ? [] : (Array.isArray(value) ? value : [value]);

const geocodeLocation = async (location) => {
    const geoData = await geocoder.forwardGeocode({ query: location, limit: 1 }).send();
    const geometry = geoData?.body?.features?.[0]?.geometry;
    if (!geometry) {
        throw new ExpressError('Location could not be found.', 400);
    }
    return geometry;
};

const pendingImages = (count) => Array.from({ length: count }, (_, index) => ({
    filename: `pending-upload-${index}`,
    url: 'https://pending.invalid/image.jpg'
}));

const cleanupAfterFailedWrite = async (uploadedImages, originalError) => {
    try {
        await cloudinaryImages.destroyImages(uploadedImages);
    } catch (cleanupError) {
        originalError.cleanupError = cleanupError;
    }
    throw originalError;
};

module.exports.index = async (req, res) => {
    const campgrounds = await Campground.find({});
    const campgroundMapData = {
        type: 'FeatureCollection',
        features: campgrounds
            .map((campground) => typeof campground.toJSON === 'function' ? campground.toJSON() : campground)
            .filter((campground) => campground?.geometry)
            .map((campground) => ({
                type: 'Feature',
                geometry: campground.geometry,
                properties: {
                    id: String(campground._id),
                    title: campground.title,
                    description: campground.description
                }
            }))
    };
    res.render('campgrounds/index', { campgrounds, campgroundMapData });
}

module.exports.renderAddCampForm = (req, res) => {
    res.render('campgrounds/new_camp');
}

module.exports.createCamp = async (req, res, next) => {
    const editableFields = editableCampgroundFields(req.body?.campground);
    const files = req.files || [];
    if (files.length === 0) {
        req.flash('error', 'Please include atleast one image!');
        return res.redirect('/campgrounds/new');
    }

    const geometry = await geocodeLocation(editableFields.location);
    const campground = new Campground(editableFields);
    campground.geometry = geometry;
    campground.author = req.user._id;
    campground.images = pendingImages(files.length);
    await campground.validate();

    const uploadedImages = await cloudinaryImages.uploadImages(files);
    campground.images = uploadedImages;
    try {
        await campground.save();
    } catch (error) {
        await cleanupAfterFailedWrite(uploadedImages, error);
    }

    req.flash('success', 'Created new campground successfully!');
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.showCamp = async (req, res, next) => {
    const campground = await Campground.findById(req.params.id)
        .populate({ path: 'reviews', populate: { path: 'author' } })
        .populate('author');
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    campground.reviews = (campground.reviews || []).filter(Boolean);
    // Calculate total rating and mean rating
    let totalRating = 0;
    let reviewCount = campground.reviews.length;
    let meanRating = 0;
    if (reviewCount > 0) {
        totalRating = campground.reviews.reduce((sum, review) => sum + review.rating, 0);
        meanRating = (totalRating / reviewCount).toFixed(1);
    }
    reviewCount = `${reviewCount} review${reviewCount === 1 ? '' : 's'}`;
    res.render('campgrounds/campground', { campground, meanRating, reviewCount });
}

module.exports.renderEditCampForm = async (req, res, next) => {
    const campground = await Campground.findById(req.params.id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    res.render('campgrounds/edit_camp', { campground });
}

module.exports.updateCamp = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }

    const editableFields = editableCampgroundFields(req.body?.campground);
    const locationChanged = Object.prototype.hasOwnProperty.call(editableFields, 'location')
        && editableFields.location !== campground.location;

    const existingImages = campground.images || [];
    const existingFilenames = new Set(existingImages.map((image) => image.filename));
    const deletedImages = [...new Set(
        asArray(req.body?.deletedImages)
            .filter((filename) => typeof filename === 'string' && existingFilenames.has(filename))
    )];
    const deletedImageSet = new Set(deletedImages);
    const retainedImages = existingImages.filter((image) => !deletedImageSet.has(image.filename));
    const files = req.files || [];

    if (retainedImages.length === 0 && files.length === 0) {
        req.flash('error', 'Please include at least one image!');
        return res.redirect(`/campgrounds/${id}/edit`);
    }
    if (retainedImages.length + files.length > cloudinaryImages.MAX_IMAGE_COUNT) {
        throw new ExpressError(`A campground can have at most ${cloudinaryImages.MAX_IMAGE_COUNT} images.`, 400);
    }

    const geometry = locationChanged
        ? await geocodeLocation(editableFields.location)
        : campground.geometry;

    campground.set(editableFields);
    campground.geometry = geometry;
    campground.images = [...retainedImages, ...pendingImages(files.length)];
    if (typeof campground.validate === 'function') await campground.validate();

    const addedImages = await cloudinaryImages.uploadImages(files);
    campground.images = [...retainedImages, ...addedImages];

    try {
        await campground.save();
    } catch (error) {
        await cleanupAfterFailedWrite(addedImages, error);
    }

    await cloudinaryImages.destroyImages(deletedImages);

    req.flash('success', 'Updated campground successfully.')
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.deleteCamp = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findByIdAndDelete(id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    await cloudinaryImages.destroyImages(campground.images || []);
    req.flash('success', 'Campground has been deleted.')
    res.redirect('/campgrounds');
}

module.exports._test = { geocoder };
