const express = require('express');
const { uploadCampgroundImages } = require('../utils/cloudinary_config');
const router = express.Router();
const campgrounds = require('../controllers/campgrounds')
const { catchAsync } = require('../utils/errorHandler');
const {
    isLoggedIn,
    isAuthor,
    validateCampground,
    validateObjectId
} = require('../utils/middlewares');

router.param('id', validateObjectId('id', 'campground ID'));

router.route('/')
    .get(catchAsync(campgrounds.index))
    .post(isLoggedIn, uploadCampgroundImages, validateCampground, catchAsync(campgrounds.createCamp));

router.get('/new', isLoggedIn, campgrounds.renderAddCampForm);

router.route('/:id')
    .get(catchAsync(campgrounds.showCamp))
    .put(isLoggedIn, catchAsync(isAuthor), uploadCampgroundImages, validateCampground, catchAsync(campgrounds.updateCamp))
    .delete(isLoggedIn, catchAsync(isAuthor), catchAsync(campgrounds.deleteCamp));

router.get('/:id/edit', isLoggedIn, catchAsync(isAuthor), catchAsync(campgrounds.renderEditCampForm));

module.exports = router;
