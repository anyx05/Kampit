const express = require('express');
const multer = require('multer');
const { storage } = require('../utils/cloudinary_config');
const upload = multer({ storage });
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
    .post(isLoggedIn, upload.array('image'), validateCampground, catchAsync(campgrounds.createCamp));

router.get('/new', isLoggedIn, campgrounds.renderAddCampForm);

router.route('/:id')
    .get(catchAsync(campgrounds.showCamp))
    .put(isLoggedIn, catchAsync(isAuthor), upload.array('image'), validateCampground, catchAsync(campgrounds.updateCamp))
    .delete(isLoggedIn, catchAsync(isAuthor), catchAsync(campgrounds.deleteCamp));

router.get('/:id/edit', isLoggedIn, catchAsync(isAuthor), catchAsync(campgrounds.renderEditCampForm));

module.exports = router;
