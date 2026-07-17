const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTestEnvironment } = require('../helpers/test-environment');

applyTestEnvironment();

const {
    consumeReturnTo,
    loadReturnTo,
    returnPathForRequest,
    safeInternalPath
} = require('../../utils/auth');
const {
    databaseNameFromUrl,
    redactSecrets,
    sessionCookieOptions,
    validateEnvironment
} = require('../../app');
const users = require('../../controllers/users');
const User = require('../../models/user');
const { isLoggedIn } = require('../../utils/middlewares');

const originalUserRegister = User.register;

test.afterEach(() => {
    User.register = originalUserRegister;
});

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
        process.env.DB_URL = 'mongodb://127.0.0.1:27017/Kampit';
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

test('environment validation requires the Kampit database path', () => {
    const originalDbUrl = process.env.DB_URL;
    try {
        process.env.DB_URL = 'mongodb://127.0.0.1:27017/another-database';
        assert.throws(validateEnvironment, /\/Kampit database path/);
        process.env.DB_URL = 'mongodb://127.0.0.1:27017/Kampit';
        assert.doesNotThrow(validateEnvironment);
        assert.equal(databaseNameFromUrl(process.env.DB_URL), 'Kampit');
    } finally {
        process.env.DB_URL = originalDbUrl;
    }
});

test('production log redaction removes configured secrets and URI credentials', () => {
    const originalDbUrl = process.env.DB_URL;
    const originalCloudinarySecret = process.env.CLOUDINARYSECRET;
    try {
        process.env.DB_URL = 'mongodb+srv://example-user:example-password@example.invalid/Kampit';
        process.env.CLOUDINARYSECRET = 'example-cloudinary-secret';
        const redacted = redactSecrets(
            `${process.env.DB_URL} ${process.env.CLOUDINARYSECRET} mongodb://user:password@example.invalid/Kampit`
        );
        assert.doesNotMatch(redacted, /example-password|example-cloudinary-secret|user:password/);
        assert.match(redacted, /\[REDACTED\]/);
    } finally {
        process.env.DB_URL = originalDbUrl;
        process.env.CLOUDINARYSECRET = originalCloudinarySecret;
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

test('signup registers, signs in, and consumes the saved internal destination', async () => {
    User.register = async (user, password) => {
        assert.equal(user.username, 'new-user');
        assert.equal(user.email, 'new@example.com');
        assert.equal(password, 'strong-password');
        return { _id: 'registered-user', username: user.username };
    };
    const flashes = [];
    const redirects = [];
    let loggedInUser;
    const req = {
        body: { username: 'new-user', email: 'new@example.com', password: 'strong-password' },
        session: { returnTo: '/campgrounds/owned' },
        login(user, callback) {
            loggedInUser = user;
            callback();
        },
        flash(...args) {
            flashes.push(args);
        }
    };
    const res = { locals: {}, redirect: (path) => redirects.push(path) };

    await users.signUp(req, res);

    assert.equal(loggedInUser.username, 'new-user');
    assert.equal(req.session.returnTo, undefined);
    assert.deepEqual(redirects, ['/campgrounds/owned']);
    assert.equal(flashes[0][0], 'success');
});

test('login redirects to the saved internal destination', async () => {
    const flashes = [];
    const redirects = [];
    const req = {
        user: { username: 'returning-user' },
        session: { returnTo: '/campgrounds/favorite' },
        flash(...args) {
            flashes.push(args);
        }
    };

    await users.login(req, { locals: {}, redirect: (path) => redirects.push(path) });

    assert.deepEqual(flashes, [['success', 'Welcome back returning-user!']]);
    assert.deepEqual(redirects, ['/campgrounds/favorite']);
});
