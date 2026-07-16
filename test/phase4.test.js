const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.MAPBOX_TOKEN ||= 'pk.eyJ1IjoidGVzdCJ9.test';

const User = require('../models/user');
const Campground = require('../models/campgrounds');
const Review = require('../models/reviews');
const campgroundController = require('../controllers/campgrounds');
const reviewController = require('../controllers/reviews');
const { cloudinary } = require('../utils/cloudinary_config');

const originalCampgroundFindById = Campground.findById;
const originalReviewSave = Review.prototype.save;
const originalCloudinaryDestroy = cloudinary.uploader.destroy;

const validCampground = () => ({
    title: '  Forest Camp  ',
    images: [{ filename: 'Kampit/forest', url: ' https://example.com/forest.jpg ' }],
    price: '42.50',
    description: '  A quiet forest campground.  ',
    location: '  Tartu County  ',
    geometry: { type: 'Point', coordinates: [26.72, 58.38] },
    author: new mongoose.Types.ObjectId()
});

test.afterEach(() => {
    Campground.findById = originalCampgroundFindById;
    Review.prototype.save = originalReviewSave;
    cloudinary.uploader.destroy = originalCloudinaryDestroy;
});

test('User schema normalizes identity fields and rejects invalid values', async () => {
    const user = new User({ username: '  Alice  ', email: '  ALICE@EXAMPLE.COM  ' });
    await user.validate();

    assert.equal(user.username, 'alice');
    assert.equal(user.email, 'alice@example.com');
    assert.equal(User.schema.options.timestamps, true);

    const invalidUser = new User({ username: 'ab', email: 'not-an-email' });
    await assert.rejects(invalidUser.validate(), (error) => {
        assert.ok(error.errors.username);
        assert.ok(error.errors.email);
        return true;
    });
});

test('Campground schema casts price to Number, trims text, and validates protected data', async () => {
    const campground = new Campground(validCampground());
    await campground.validate();

    assert.equal(campground.price, 42.5);
    assert.equal(typeof campground.price, 'number');
    assert.equal(campground.title, 'Forest Camp');
    assert.equal(campground.description, 'A quiet forest campground.');
    assert.equal(campground.location, 'Tartu County');
    assert.equal(campground.images[0].url, 'https://example.com/forest.jpg');
    assert.equal(Campground.schema.options.timestamps, true);

    const invalidCampground = new Campground({
        ...validCampground(),
        images: [],
        price: -1,
        geometry: { type: 'Point', coordinates: [181, 91] },
        author: undefined
    });

    await assert.rejects(invalidCampground.validate(), (error) => {
        assert.ok(error.errors.images);
        assert.ok(error.errors.price);
        assert.ok(error.errors['geometry.coordinates']);
        assert.ok(error.errors.author);
        return true;
    });
});

test('Review schema trims text and rejects missing authors and out-of-range ratings', async () => {
    const review = new Review({
        body: '  Excellent stay.  ',
        rating: 5,
        author: new mongoose.Types.ObjectId()
    });
    await review.validate();

    assert.equal(review.body, 'Excellent stay.');
    assert.equal(Review.schema.options.timestamps, true);

    const invalidReview = new Review({ body: '   ', rating: 5.5 });
    await assert.rejects(invalidReview.validate(), (error) => {
        assert.ok(error.errors.body);
        assert.ok(error.errors.rating);
        assert.ok(error.errors.author);
        return true;
    });
});

test('query updates run schema validators by default', async () => {
    const id = new mongoose.Types.ObjectId();

    await assert.rejects(
        Campground.findOneAndUpdate({ _id: id }, { $set: { price: -1 } }),
        /Price cannot be negative/
    );
    await assert.rejects(
        Review.findOneAndUpdate({ _id: id }, { $set: { rating: 6 } }),
        /Rating cannot exceed 5/
    );
    await assert.rejects(
        User.findOneAndUpdate({ _id: id }, { $set: { email: 'invalid' } }),
        /Email must be valid/
    );
});

test('campground updates allowlist editable fields and ignore protected-field attacks', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const originalAuthor = new mongoose.Types.ObjectId();
    const originalReview = new mongoose.Types.ObjectId();
    const originalGeometry = { type: 'Point', coordinates: [24.75, 59.44] };
    let assignedFields;
    let saved = false;

    const campground = {
        _id: new mongoose.Types.ObjectId(),
        author: originalAuthor,
        reviews: [originalReview],
        images: [{ filename: 'Kampit/owned', url: 'https://example.com/owned.jpg' }],
        geometry: originalGeometry,
        set(fields) {
            assignedFields = fields;
            Object.assign(this, fields);
        },
        async save() {
            saved = true;
        }
    };

    Campground.findById = async () => campground;
    cloudinary.uploader.destroy = async () => assert.fail('an unowned image must not be deleted');

    const redirects = [];
    await campgroundController.updateCamp({
        params: { id: String(campground._id) },
        body: {
            campground: {
                title: 'Updated title',
                price: '25',
                description: 'Updated description',
                location: 'Updated location',
                author: ownerId,
                reviews: [],
                images: [],
                geometry: { type: 'Point', coordinates: [0, 0] }
            },
            deletedImages: ['another-account/image']
        },
        files: [],
        flash() {}
    }, {
        redirect(path) {
            redirects.push(path);
        }
    });

    assert.deepEqual(assignedFields, {
        title: 'Updated title',
        price: '25',
        description: 'Updated description',
        location: 'Updated location'
    });
    assert.equal(campground.author, originalAuthor);
    assert.deepEqual(campground.reviews, [originalReview]);
    assert.deepEqual(campground.geometry, originalGeometry);
    assert.deepEqual(campground.images, [
        { filename: 'Kampit/owned', url: 'https://example.com/owned.jpg' }
    ]);
    assert.equal(saved, true);
    assert.deepEqual(redirects, [`/campgrounds/${campground._id}`]);
});

test('review creation ignores a submitted author and uses the signed-in user', async () => {
    const signedInUser = new mongoose.Types.ObjectId();
    const submittedAuthor = new mongoose.Types.ObjectId();
    let savedReview;
    const campground = {
        _id: new mongoose.Types.ObjectId(),
        reviews: [],
        async save() {}
    };

    Campground.findById = async () => campground;
    Review.prototype.save = async function saveReview() {
        savedReview = this;
        return this;
    };

    const redirects = [];
    await reviewController.addReview({
        params: { id: String(campground._id) },
        user: { _id: signedInUser },
        body: {
            review: {
                body: 'Safe review',
                rating: 4,
                author: submittedAuthor,
                createdAt: new Date(0)
            }
        }
    }, {
        redirect(path) {
            redirects.push(path);
        }
    });

    assert.equal(savedReview.body, 'Safe review');
    assert.equal(savedReview.rating, 4);
    assert.equal(String(savedReview.author), String(signedInUser));
    assert.equal(savedReview.createdAt, undefined);
    assert.equal(String(campground.reviews[0]._id), String(savedReview._id));
    assert.deepEqual(redirects, [`/campgrounds/${campground._id}`]);
});
