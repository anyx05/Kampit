const express = require('express');
const router = express.Router({ mergeParams: true });
const reviews = require('../controllers/reviews')
const { catchAsync } = require('../utils/errorHandler');
const { isLoggedIn, isReviewAuthor, validateReviews } = require('../utils/middlewares');

router.post('/', isLoggedIn, validateReviews, catchAsync(reviews.addReview))
router.delete('/:reviewId', isLoggedIn, isReviewAuthor, catchAsync(reviews.deleteReviews))

module.exports = router;