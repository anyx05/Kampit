
const Campground = require('../models/campgrounds');
const { cloudinary } = require('../utils/cloudinary_config');
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
                properties: campground.properties || {}
            }))
    };
    res.render('campgrounds/index', { campgrounds, campgroundMapData });
}

module.exports.renderAddCampForm = (req, res) => {
    res.render('campgrounds/new_camp');
}

module.exports.createCamp = async (req, res, next) => {
    const editableFields = editableCampgroundFields(req.body?.campground);
    const geoData = await geocoder.forwardGeocode({
        query: editableFields.location,
        limit: 1
    }).send();
    const uploadedImages = req.files || [];
    if (uploadedImages.length === 0) {
        req.flash('error', 'Please include atleast one image!');
        return res.redirect('/campgrounds/new');
    }
    const campground = new Campground(editableFields);
    campground.geometry = geoData.body.features[0].geometry;
    campground.author = req.user._id;
    campground.images = uploadedImages.map((img) => ({ filename: img.filename, url: img.path }));
    await campground.save();
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

    campground.set(editableCampgroundFields(req.body?.campground));

    const existingImages = campground.images || [];
    const existingFilenames = new Set(existingImages.map((image) => image.filename));
    const deletedImages = [...new Set(
        asArray(req.body?.deletedImages)
            .filter((filename) => typeof filename === 'string' && existingFilenames.has(filename))
    )];
    const deletedImageSet = new Set(deletedImages);
    const retainedImages = existingImages.filter((image) => !deletedImageSet.has(image.filename));
    const addedImages = (req.files || [])
        .map((img) => ({ filename: img.filename, url: img.path }));

    if (retainedImages.length === 0 && addedImages.length === 0) {
        req.flash('error', 'Please include at least one image!');
        return res.redirect(`/campgrounds/${id}/edit`);
    }

    campground.images = [...retainedImages, ...addedImages];
    await campground.save();

    await Promise.all(deletedImages.map((filename) => cloudinary.uploader.destroy(filename)));

    req.flash('success', 'Updated campground successfully.')
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.deleteCamp = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findByIdAndDelete(id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    req.flash('success', 'Campground has been deleted.')
    res.redirect('/campgrounds');
}
