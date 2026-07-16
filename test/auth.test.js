const test = require('node:test');
const assert = require('node:assert/strict');

const {
    consumeReturnTo,
    loadReturnTo,
    returnPathForRequest,
    safeInternalPath
} = require('../utils/auth');
const { sessionCookieOptions, validateEnvironment } = require('../app');
const users = require('../controllers/users');
const { isLoggedIn } = require('../utils/middlewares');

test('safeInternalPath accepts local paths and rejects redirect injection', () => {
    assert.equal(safeInternalPath('/campgrounds/123?tab=reviews'), '/campgrounds/123?tab=reviews');
    assert.equal(safeInternalPath('https://example.com'), null);
    assert.equal(safeInternalPath('//example.com/path'), null);
    assert.equal(safeInternalPath('/%2f%2fexample.com'), null);
    assert.equal(safeInternalPath('/\\example.com'), null);
    assert.equal(safeInternalPath('/%5cexample.com'), null);
});

test('review actions return to the campground detail page', () => {
    assert.equal(
        returnPathForRequest({ originalUrl: '/campgrounds/abc/reviews/def?_method=DELETE' }),
        '/campgrounds/abc'
    );
});

test('authentication middleware captures a safe return path only when login is required', () => {
    const flashes = [];
    const req = {
        isAuthenticated: () => false,
        originalUrl: '/campgrounds/abc/reviews',
        session: {},
        flash: (...args) => flashes.push(args)
    };
    const res = { redirect: (path) => assert.equal(path, '/login') };

    isLoggedIn(req, res, () => assert.fail('unauthenticated request must not continue'));
    assert.equal(req.session.returnTo, '/campgrounds/abc');
    assert.deepEqual(flashes, [['error', 'You must be signed in first!']]);
});

test('returnTo is consumed once and removed from the session', () => {
    const req = { session: { returnTo: '/campgrounds/abc' } };
    const res = { locals: {} };

    loadReturnTo(req, res, () => {});
    assert.equal(consumeReturnTo(req, res), '/campgrounds/abc');
    assert.equal(req.session.returnTo, undefined);
    assert.equal(consumeReturnTo(req, res), '/campgrounds');
});

test('unsafe session returnTo is discarded', () => {
    const req = { session: { returnTo: '//example.com' } };
    const res = { locals: {} };

    loadReturnTo(req, res, () => {});
    assert.equal(req.session.returnTo, undefined);
    assert.equal(consumeReturnTo(req, res), '/campgrounds');
});

test('session cookies are secure only in production and always hardened', () => {
    assert.deepEqual(sessionCookieOptions(true), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 604800000
    });
    assert.equal(sessionCookieOptions(false).secure, false);
});

test('environment validation requires separate session signing and store encryption secrets', () => {
    const names = [
        'DB_URL',
        'SESSION_SECRET',
        'MONGO_STORE_SECRET',
        'MAPBOX_TOKEN',
        'CLOUDNAME',
        'CLOUDINARYKEY',
        'CLOUDINARYSECRET'
    ];
    const previousValues = Object.fromEntries(names.map((name) => [name, process.env[name]]));

    try {
        for (const name of names) process.env[name] = `test-${name}`;
        process.env.MONGO_STORE_SECRET = process.env.SESSION_SECRET;
        assert.throws(validateEnvironment, /must be different/);

        process.env.MONGO_STORE_SECRET = 'test-distinct-store-secret';
        assert.doesNotThrow(validateEnvironment);
    } finally {
        for (const name of names) {
            if (previousValues[name] === undefined) delete process.env[name];
            else process.env[name] = previousValues[name];
        }
    }
});

test('signout waits for Passport and sends callback errors to catchAsync', async () => {
    const redirects = [];
    const flashes = [];
    const req = {
        logout(callback) {
            callback();
        },
        flash(...args) {
            flashes.push(args);
        }
    };
    const res = { redirect: (path) => redirects.push(path) };

    await users.signout(req, res);
    assert.deepEqual(flashes, [['success', 'Sign out successful!']]);
    assert.deepEqual(redirects, ['/campgrounds']);

    const failure = new Error('logout failed');
    await assert.rejects(
        users.signout({ logout: (callback) => callback(failure) }, res),
        failure
    );
});
