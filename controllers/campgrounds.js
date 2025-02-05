
const Campground = require('../models/campgrounds');
const { cloudinary } = require('../utils/cloudinary_config');
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });


module.exports.index = async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds });
}

module.exports.renderAddCampForm = (req, res) => {
    res.render('campgrounds/new_camp');
}

module.exports.createCamp = async (req, res, next) => {
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send();
    if (req.files.length == 0) {
        req.flash('error', 'Please include atleast one image!');
        return res.redirect('/campgrounds/new');
    }
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.author = req.user._id;
    campground.images = req.files.map((img) => ({ filename: img.filename, url: img.path }));
    await campground.save();
    console.log(campground);
    req.flash('success', 'Created new campground successfully!');
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.showCamp = async (req, res, next) => {
    const campground = await Campground.findById(req.params.id)
        .populate({ path: 'reviews', populate: { path: 'author' } })
        .populate('author');
    if (!campground) {
        req.flash('error', 'Campground not found!');
        return res.redirect('/campgrounds');
    }
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
    res.render('campgrounds/edit_camp', { campground });
}

module.exports.updateCamp = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });
    const addedImages = req.files.map((img) => ({ filename: img.filename, url: img.path }));
    const allDeleted = req.body.deletedImages.every((imageUrl, index) => {
        return imageUrl === campground.images[index].filename;
    })
    if (addedImages.length === 0 && allDeleted) { 
        req.flash('error', 'Please include at least one image!');
        return res.redirect(`/campgrounds/${id}/edit`);
    }
    campground.images.push(...addedImages);
    const deletedImages = (req.body.deletedImages) ? req.body.deletedImages.filter((url) => url != "") : undefined;
    if (deletedImages) {
        for (let image of deletedImages) {
            await cloudinary.uploader.destroy(image);
        }
        await campground.updateOne({ $pull: { images: { filename: { $in: deletedImages } } } });
    }
    await campground.save();
    req.flash('success', 'Updated campground successfully.')
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.deleteCamp = async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Campground has been deleted.')
    res.redirect('/campgrounds');
}