const Campground = require('../models/campgrounds');
const Review = require('../models/reviews');
const { ExpressError } = require('../utils/errorHandler');

const sameObjectId = (left, right) => Boolean(
    left && right && String(left._id || left) === String(right._id || right)
);

module.exports.addReview = async (req, res) => {
    const campground = await Campground.findById(req.params.id);
    if (!campground) {
        throw new ExpressError('Campground not found.', 404);
    }
    if (!req.user?._id) {
        throw new ExpressError('User not found.', 404);
    }
    const review = new Review(req.body.review);
    review.author = req.user._id;
    campground.reviews.push(review);
    await review.save();
    await campground.save();
    res.redirect(`/campgrounds/${campground._id}`);
}
module.exports.deleteReviews = async (req, res) => {
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
    await Campground.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/campgrounds/${id}`);
}
