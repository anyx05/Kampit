const Campground = require('../models/campgrounds');
const Review = require('../models/reviews');
const { body, validationResult } = require('express-validator');
const { ExpressError } = require('../utils/errorHandler');

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
        req.flash('error', 'You must be signed in first!');
        return res.redirect('/login');
    }
    next();
}

const redirectIfLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/campgrounds');
    }
    if (req.session.returnTo) { //for this stateful experience most webapps just us popups(something is needed for the reviews)
        res.locals.returnTo = req.session.returnTo;
    }
    next();
}

const isAuthor = async (req, res, next) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    if (!campground) {
        return res.redirect('/campgrounds');
    };
    if (!campground.author.equals(req.user._id)) {
        req.flash("error", "You can only manage campgrounds listed by you!");
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

const isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(req.user._id)) {
        req.flash("error", "You can only manage reviews posted by you!");
        return res.redirect(`/campgrounds/${id}`);
    }
    next();
}

module.exports = { isLoggedIn, redirectIfLoggedIn, validateCampground, validateReviews, isAuthor, isReviewAuthor };