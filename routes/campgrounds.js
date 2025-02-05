const express = require('express');
const multer = require('multer');
const { storage } = require('../utils/cloudinary_config');
const upload = multer({ storage });
const router = express.Router();
const campgrounds = require('../controllers/campgrounds')
const { catchAsync } = require('../utils/errorHandler');
const { isLoggedIn, isAuthor, validateCampground } = require('../utils/middlewares');

router.route('/')
    .get(catchAsync(campgrounds.index))
    .post(isLoggedIn, upload.array('image'), validateCampground, catchAsync(campgrounds.createCamp));

router.get('/new', isLoggedIn, campgrounds.renderAddCampForm);

router.route('/:id')
    .get(catchAsync(campgrounds.showCamp))
    .put(isLoggedIn, isAuthor, upload.array('image'), validateCampground, catchAsync(campgrounds.updateCamp))
    .delete(isLoggedIn, isAuthor, catchAsync(campgrounds.deleteCamp));

router.get('/:id/edit', isLoggedIn, isAuthor, catchAsync(campgrounds.renderEditCampForm));

module.exports = router;