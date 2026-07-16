const Campground = require('../models/campgrounds');
const Review = require('../models/reviews');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { ExpressError } = require('../utils/errorHandler');
const { returnPathForRequest } = require('./auth');

const sameObjectId = (left, right) => Boolean(
    left && right && String(left._id || left) === String(right._id || right)
);

const validateCampground = [
    body('campground.title').trim().notEmpty().withMessage('Title is required').escape(),
    body('campground.price').isFloat({ min: 0 }).withMessage('Price must be a number and greater than or equal to 0'),
    body('campground.location').trim().notEmpty().withMessage('Location is required').escape(),
    body('campground.description').trim().notEmpty().withMessage('Description is required').escape(),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const msg = errors.array().map(err => err.msg).join(', ');
            throw new ExpressError(msg, 400);
        }
        next();
    }
  ];

const validateReviews = [
    body('review.body').trim().notEmpty().withMessage('Review body is required.').escape(),
    body('review.rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const msg = errors.array().map(err => err.msg).join(', ');
            throw new ExpressError(msg, 400);
        }
        next();
    }
]

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        const returnTo = returnPathForRequest(req);
        if (returnTo) req.session.returnTo = returnTo;
        req.flash('error', 'You must be signed in first!');
        return res.redirect('/login');
    }
    next();
}

const redirectIfLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/campgrounds');
    }
    next();
}

const validateObjectId = (paramName, label = 'Object ID') => (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params[paramName])) {
        throw new ExpressError(`Malformed ${label}.`, 400);
    }
    next();
};

const isAuthor = async (req, res, next) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    if (!campground.author) {
        throw new ExpressError('Campground author not found.', 404);
    }
    if (!req.user?._id) {
        throw new ExpressError('User not found.', 404);
    }
    if (!sameObjectId(campground.author, req.user._id)) {
        req.flash("error", "You can only manage campgrounds listed by you!");
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

const isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const campground = await Campground.findById(id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ExpressError('Review not found.', 404);
    }

    const belongsToCampground = (campground.reviews || [])
        .some((storedReviewId) => sameObjectId(storedReviewId, review._id));
    if (!belongsToCampground) {
        throw new ExpressError('Review not found for this campground.', 404);
    }
    if (!review.author) {
        throw new ExpressError('Review author not found.', 404);
    }
    if (!req.user?._id) {
        throw new ExpressError('User not found.', 404);
    }
    if (!sameObjectId(review.author, req.user._id)) {
        req.flash("error", "You can only manage reviews posted by you!");
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

module.exports = {
    isLoggedIn,
    redirectIfLoggedIn,
    validateCampground,
    validateReviews,
    validateObjectId,
    isAuthor,
    isReviewAuthor
};
