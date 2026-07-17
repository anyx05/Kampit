const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const ejsMate = require('ejs-mate');
const mongoose = require('mongoose');
const { request } = require('../helpers/http');
const { applyTestEnvironment } = require('../helpers/test-environment');

applyTestEnvironment();

const Campground = require('../../models/campgrounds');
const Review = require('../../models/reviews');
const campgroundRoutes = require('../../routes/campgrounds');
const reviewRoutes = require('../../routes/reviews');
const { ExpressError } = require('../../utils/errorHandler');

const originalCampgroundMethods = {
    find: Campground.find,
    findById: Campground.findById
};
const originalReviewMethods = {
    findById: Review.findById
};

function populatedQuery(value) {
    const query = {
        populate() {
            return query;
        },
        then(resolve, reject) {
            return Promise.resolve(value).then(resolve, reject);
        }
    };
    return query;
}

function createRouteApp({ authenticated = false } = {}) {
    const app = express();
    app.engine('ejs', ejsMate);
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', '..', 'views'));
    app.use(express.urlencoded({ extended: true }));
    app.use((req, res, next) => {
        req.isAuthenticated = () => authenticated;
        req.user = authenticated ? { _id: new mongoose.Types.ObjectId(), username: 'tester' } : undefined;
        req.session = {};
        req.flash = () => [];
        res.locals.signedUser = req.user || null;
        res.locals.success = [];
        res.locals.error = [];
        next();
    });

    app.get('/', (req, res) => res.render('home'));
    app.use('/campgrounds', campgroundRoutes);
    app.use('/campgrounds/:id/reviews', reviewRoutes);
    app.all('*', () => {
        throw new ExpressError('Page Not Found', 404);
    });
    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || err.status || 500;
        res.status(statusCode).render('error', { err, statusCode });
    });
    return app;
}

test.afterEach(() => {
    Campground.find = originalCampgroundMethods.find;
    Campground.findById = originalCampgroundMethods.findById;
    Review.findById = originalReviewMethods.findById;
});

test('GET / renders the public home page', async () => {
    const response = await request(createRouteApp(), '/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Kamp/i);
});

test('GET /campgrounds renders when MongoDB find returns an empty array', async () => {
    Campground.find = async () => [];

    const response = await request(createRouteApp(), '/campgrounds');
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /No campgrounds have been listed yet/);
    assert.match(html, /"type":"FeatureCollection","features":\[\]/);
});

test('campground map data escapes script-breaking stored content', async () => {
    Campground.find = async () => [{
        _id: new mongoose.Types.ObjectId(),
        title: '</script><script>globalThis.injected=true</script>',
        description: 'Unsafe <markup>',
        location: 'Test location',
        images: [{ url: 'https://example.com/camp.jpg' }],
        geometry: { type: 'Point', coordinates: [24, 59] },
        toJSON() {
            return this;
        }
    }];

    const response = await request(createRouteApp(), '/campgrounds');
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(html, /<script>globalThis\.injected=true<\/script>/);
    assert.match(html, /\\u003c\/script>/);
});

test('malformed campground IDs return 400 without querying MongoDB', async () => {
    Campground.findById = () => assert.fail('malformed IDs must not reach MongoDB');

    const response = await request(createRouteApp(), '/campgrounds/not-an-object-id');
    assert.equal(response.status, 400);
    assert.match(await response.text(), /Malformed campground ID/);
});

test('valid absent campground IDs return 404', async () => {
    Campground.findById = () => populatedQuery(null);
    const id = new mongoose.Types.ObjectId();

    const response = await request(createRouteApp(), `/campgrounds/${id}`);
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Campground not found/);
});

test('missing reviews return 404 through async authorization middleware', async () => {
    const campgroundId = new mongoose.Types.ObjectId();
    const reviewId = new mongoose.Types.ObjectId();
    Campground.findById = async () => ({ reviews: [reviewId] });
    Review.findById = async () => null;

    const response = await request(
        createRouteApp({ authenticated: true }),
        `/campgrounds/${campgroundId}/reviews/${reviewId}`,
        { method: 'DELETE' }
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Review not found/);
});

test('malformed review IDs return 400 before authorization queries', async () => {
    const campgroundId = new mongoose.Types.ObjectId();
    Campground.findById = () => assert.fail('malformed review IDs must not reach MongoDB');

    const response = await request(
        createRouteApp({ authenticated: true }),
        `/campgrounds/${campgroundId}/reviews/not-an-object-id`,
        { method: 'DELETE' }
    );

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Malformed review ID/);
});

test('orphaned reviews and deleted review authors return 404 without dereferencing null', async () => {
    const campgroundId = new mongoose.Types.ObjectId();
    const reviewId = new mongoose.Types.ObjectId();
    Campground.findById = async () => ({ reviews: [null, reviewId] });
    Review.findById = async () => ({ _id: reviewId, author: null });

    const response = await request(
        createRouteApp({ authenticated: true }),
        `/campgrounds/${campgroundId}/reviews/${reviewId}`,
        { method: 'DELETE' }
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Review author not found/);
});

test('campground pages tolerate deleted authors and orphaned populated reviews', async () => {
    const campgroundId = new mongoose.Types.ObjectId();
    Campground.findById = () => populatedQuery({
        _id: campgroundId,
        title: 'Authorless Camp',
        images: [],
        price: '10',
        description: 'Still available after its author was deleted.',
        location: 'Test Valley',
        geometry: { type: 'Point', coordinates: [24, 59] },
        author: null,
        reviews: [
            null,
            {
                _id: new mongoose.Types.ObjectId(),
                body: 'A surviving review',
                rating: 4,
                author: null
            }
        ]
    });

    const response = await request(createRouteApp(), `/campgrounds/${campgroundId}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Authorless Camp/);
    assert.match(html, /Deleted user/);
    assert.match(html, /A surviving review/);
});

test('review creation returns 404 when its campground does not exist', async () => {
    Campground.findById = async () => null;
    const campgroundId = new mongoose.Types.ObjectId();

    const response = await request(
        createRouteApp({ authenticated: true }),
        `/campgrounds/${campgroundId}/reviews`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'review%5Bbody%5D=Missing+campground&review%5Brating%5D=5'
        }
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Campground not found/);
});

test('unknown routes return 404', async () => {
    const response = await request(createRouteApp(), '/this-route-does-not-exist');
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Page Not Found/);
});
