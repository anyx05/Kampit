const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

process.env.MAPBOX_TOKEN ||= 'pk.eyJ1IjoidGVzdCJ9.test';

const Campground = require('../models/campgrounds');
const campgroundController = require('../controllers/campgrounds');
const cloudinaryImages = require('../utils/cloudinary_config');
const campgroundRoutes = require('../routes/campgrounds');

const originalMethods = {
    campgroundFindById: Campground.findById,
    campgroundFindByIdAndDelete: Campground.findByIdAndDelete,
    campgroundSave: Campground.prototype.save,
    destroyImages: cloudinaryImages.destroyImages,
    uploadImages: cloudinaryImages.uploadImages,
    uploadStream: cloudinaryImages.cloudinary.uploader.upload_stream,
    cloudinaryDestroy: cloudinaryImages.cloudinary.uploader.destroy,
    forwardGeocode: campgroundController._test.geocoder.forwardGeocode
};

const validBody = (location = 'Tartu County') => ({
    campground: {
        title: 'Forest Camp',
        price: '42.50',
        description: 'A quiet forest campground.',
        location
    }
});

const geocodeResult = (coordinates = [26.72, 58.38]) => () => ({
    send: async () => ({
        body: { features: [{ geometry: { type: 'Point', coordinates } }] }
    })
});

function responseRecorder() {
    return {
        redirects: [],
        redirect(path) {
            this.redirects.push(path);
        }
    };
}

async function request(app, options = {}) {
    const server = await new Promise((resolve, reject) => {
        const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
        listeningServer.once('error', reject);
    });

    try {
        return await fetch(`http://127.0.0.1:${server.address().port}/campgrounds`, {
            method: 'POST',
            redirect: 'manual',
            ...options
        });
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

function uploadTestApp(middleware = cloudinaryImages.uploadCampgroundImages) {
    const app = express();
    app.post('/campgrounds', middleware, (req, res) => res.status(204).end());
    app.use((error, req, res, next) => {
        res.status(error.statusCode || 500).send(error.message);
    });
    return app;
}

function campgroundRouteApp() {
    const app = express();
    app.use((req, res, next) => {
        req.isAuthenticated = () => true;
        req.user = { _id: new mongoose.Types.ObjectId() };
        req.flash = () => [];
        next();
    });
    app.use('/campgrounds', campgroundRoutes);
    app.use((error, req, res, next) => {
        res.status(error.statusCode || 500).send(error.message);
    });
    return app;
}

test.afterEach(() => {
    Campground.findById = originalMethods.campgroundFindById;
    Campground.findByIdAndDelete = originalMethods.campgroundFindByIdAndDelete;
    Campground.prototype.save = originalMethods.campgroundSave;
    cloudinaryImages.destroyImages = originalMethods.destroyImages;
    cloudinaryImages.uploadImages = originalMethods.uploadImages;
    cloudinaryImages.cloudinary.uploader.upload_stream = originalMethods.uploadStream;
    cloudinaryImages.cloudinary.uploader.destroy = originalMethods.cloudinaryDestroy;
    campgroundController._test.geocoder.forwardGeocode = originalMethods.forwardGeocode;
});

test('Multer rejects unsupported image types, excessive counts, and oversized files', async () => {
    const invalidType = new FormData();
    invalidType.append('image', new Blob(['text'], { type: 'text/plain' }), 'camp.txt');
    let response = await request(uploadTestApp(), { body: invalidType });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /JPEG or PNG/);

    const tooMany = new FormData();
    for (let index = 0; index < cloudinaryImages.MAX_IMAGE_COUNT + 1; index += 1) {
        tooMany.append('image', new Blob(['x'], { type: 'image/png' }), `${index}.png`);
    }
    response = await request(uploadTestApp(), { body: tooMany });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /at most 5 images/);

    const tooLarge = new FormData();
    tooLarge.append(
        'image',
        new Blob([Buffer.alloc(cloudinaryImages.MAX_IMAGE_SIZE_BYTES + 1)], { type: 'image/jpeg' }),
        'large.jpg'
    );
    response = await request(uploadTestApp(), { body: tooLarge });
    assert.equal(response.status, 413);
    assert.match(await response.text(), /5 MB or smaller/);
});

test('multipart form fields are validated before Cloudinary upload starts', async () => {
    cloudinaryImages.uploadImages = async () => assert.fail('invalid form data must not reach Cloudinary');
    const form = new FormData();
    form.append('campground[title]', '');
    form.append('campground[price]', '25');
    form.append('campground[description]', 'Description');
    form.append('campground[location]', 'Tartu');
    form.append('image', new Blob(['not uploaded'], { type: 'image/png' }), 'camp.png');

    const response = await request(campgroundRouteApp(), { body: form });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /Title is required/);
});

test('zero-feature Mapbox responses fail before Cloudinary upload', async () => {
    campgroundController._test.geocoder.forwardGeocode = () => ({
        send: async () => ({ body: { features: [] } })
    });
    cloudinaryImages.uploadImages = async () => assert.fail('unresolved locations must not upload');

    await assert.rejects(
        campgroundController.createCamp({
            body: validBody('Unknown place'),
            files: [{ buffer: Buffer.from('image') }],
            user: { _id: new mongoose.Types.ObjectId() },
            flash() {}
        }, responseRecorder()),
        (error) => error.statusCode === 400 && /could not be found/.test(error.message)
    );
});

test('a partial Cloudinary upload failure removes successful uploads from the batch', async () => {
    const destroyed = [];
    cloudinaryImages.cloudinary.uploader.upload_stream = (options, callback) => ({
        end(buffer) {
            if (buffer.toString() === 'bad') return callback(new Error('Cloudinary upload failed'));
            callback(null, { public_id: 'Kampit/good', secure_url: 'https://example.com/good.jpg' });
        }
    });
    cloudinaryImages.cloudinary.uploader.destroy = async (filename) => destroyed.push(filename);

    await assert.rejects(
        cloudinaryImages.uploadImages([
            { buffer: Buffer.from('good') },
            { buffer: Buffer.from('bad') }
        ]),
        /Cloudinary upload failed/
    );
    assert.deepEqual(destroyed, ['Kampit/good']);
});

test('MongoDB creation failure removes every newly uploaded image', async () => {
    const uploadedImages = [
        { filename: 'Kampit/one', url: 'https://example.com/one.jpg' },
        { filename: 'Kampit/two', url: 'https://example.com/two.jpg' }
    ];
    const destroyed = [];
    campgroundController._test.geocoder.forwardGeocode = geocodeResult();
    cloudinaryImages.uploadImages = async () => uploadedImages;
    cloudinaryImages.destroyImages = async (images) => destroyed.push(...images.map((image) => image.filename));
    Campground.prototype.save = async () => {
        throw new Error('MongoDB create failed');
    };

    await assert.rejects(
        campgroundController.createCamp({
            body: validBody(),
            files: [{ buffer: Buffer.from('one') }, { buffer: Buffer.from('two') }],
            user: { _id: new mongoose.Types.ObjectId() },
            flash() {}
        }, responseRecorder()),
        /MongoDB create failed/
    );
    assert.deepEqual(destroyed, ['Kampit/one', 'Kampit/two']);
});

test('updates tolerate absent deletedImages, re-geocode changes, and save once before cleanup', async () => {
    const events = [];
    const campground = {
        _id: new mongoose.Types.ObjectId(),
        location: 'Old location',
        geometry: { type: 'Point', coordinates: [24, 59] },
        images: [{ filename: 'Kampit/existing', url: 'https://example.com/existing.jpg' }],
        set(fields) {
            Object.assign(this, fields);
        },
        async validate() {
            events.push('validate');
        },
        async save() {
            events.push('save');
        }
    };
    Campground.findById = async () => campground;
    campgroundController._test.geocoder.forwardGeocode = geocodeResult([25, 58]);
    cloudinaryImages.uploadImages = async () => {
        events.push('upload');
        return [{ filename: 'Kampit/new', url: 'https://example.com/new.jpg' }];
    };
    cloudinaryImages.destroyImages = async (images) => events.push(`destroy:${images.length}`);

    const res = responseRecorder();
    await campgroundController.updateCamp({
        params: { id: String(campground._id) },
        body: validBody('New location'),
        files: [{ buffer: Buffer.from('new') }],
        flash() {}
    }, res);

    assert.deepEqual(campground.geometry, { type: 'Point', coordinates: [25, 58] });
    assert.deepEqual(campground.images, [
        { filename: 'Kampit/existing', url: 'https://example.com/existing.jpg' },
        { filename: 'Kampit/new', url: 'https://example.com/new.jpg' }
    ]);
    assert.deepEqual(events, ['validate', 'upload', 'save', 'destroy:0']);
    assert.deepEqual(res.redirects, [`/campgrounds/${campground._id}`]);
});

test('MongoDB update failure removes only newly uploaded assets and retains old assets', async () => {
    const destroyed = [];
    const campground = {
        _id: new mongoose.Types.ObjectId(),
        location: 'Tartu County',
        geometry: { type: 'Point', coordinates: [26.72, 58.38] },
        images: [{ filename: 'Kampit/old', url: 'https://example.com/old.jpg' }],
        set(fields) {
            Object.assign(this, fields);
        },
        async validate() {},
        async save() {
            throw new Error('MongoDB update failed');
        }
    };
    Campground.findById = async () => campground;
    cloudinaryImages.uploadImages = async () => [
        { filename: 'Kampit/new', url: 'https://example.com/new.jpg' }
    ];
    cloudinaryImages.destroyImages = async (images) => {
        destroyed.push(...images.map((image) => typeof image === 'string' ? image : image.filename));
    };

    await assert.rejects(
        campgroundController.updateCamp({
            params: { id: String(campground._id) },
            body: { ...validBody(), deletedImages: ['Kampit/old'] },
            files: [{ buffer: Buffer.from('new') }],
            flash() {}
        }, responseRecorder()),
        /MongoDB update failed/
    );
    assert.deepEqual(destroyed, ['Kampit/new']);
});

test('campground deletion removes its unique Cloudinary assets after MongoDB deletion', async () => {
    const id = new mongoose.Types.ObjectId();
    const events = [];
    Campground.findByIdAndDelete = async () => {
        events.push('mongo-delete');
        return {
            _id: id,
            images: [
                { filename: 'Kampit/one' },
                { filename: 'Kampit/two' },
                { filename: 'Kampit/one' }
            ]
        };
    };
    cloudinaryImages.destroyImages = async (images) => {
        events.push(`cloudinary:${[...new Set(images.map((image) => image.filename))].join(',')}`);
    };

    const res = responseRecorder();
    await campgroundController.deleteCamp({ params: { id: String(id) }, flash() {} }, res);

    assert.deepEqual(events, ['mongo-delete', 'cloudinary:Kampit/one,Kampit/two']);
    assert.deepEqual(res.redirects, ['/campgrounds']);
});

test('failed MongoDB deletion never removes Cloudinary assets', async () => {
    Campground.findByIdAndDelete = async () => {
        throw new Error('MongoDB delete failed');
    };
    cloudinaryImages.destroyImages = async () => assert.fail('assets must remain when MongoDB deletion fails');

    await assert.rejects(
        campgroundController.deleteCamp({ params: { id: String(new mongoose.Types.ObjectId()) } }, responseRecorder()),
        /MongoDB delete failed/
    );
});
