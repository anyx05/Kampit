const express = require('express');
const router = express.Router({ mergeParams: true });
const reviews = require('../controllers/reviews')
const { catchAsync } = require('../utils/errorHandler');
const {
    isLoggedIn,
    isReviewAuthor,
    validateReviews,
    validateObjectId
} = require('../utils/middlewares');

router.post(
    '/',
    validateObjectId('id', 'campground ID'),
    isLoggedIn,
    validateReviews,
    catchAsync(reviews.addReview)
);
router.delete(
    '/:reviewId',
    validateObjectId('id', 'campground ID'),
    validateObjectId('reviewId', 'review ID'),
    isLoggedIn,
    catchAsync(isReviewAuthor),
    catchAsync(reviews.deleteReviews)
);

module.exports = router;
