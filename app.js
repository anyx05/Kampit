if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const express = require('express');
const ejsMate = require('ejs-mate');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const dns = require('node:dns');
const path = require('path');
const methodOverride = require('method-override');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');

const { ExpressError } = require('./utils/errorHandler');
const User = require('./models/user'); //used by passport

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const DATABASE_NAME = 'Kampit';
const REQUIRED_ENVIRONMENT_VARIABLES = [
    'DB_URL',
    'SESSION_SECRET',
    'MONGO_STORE_SECRET',
    'MAPBOX_TOKEN',
    'CLOUDNAME',
    'CLOUDINARYKEY',
    'CLOUDINARYSECRET'
];

function validateEnvironment() {
    const missingVariables = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => {
        const value = process.env[name];
        return typeof value !== 'string' || value.trim() === '';
    });

    if (missingVariables.length) {
        throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
    }

    if (process.env.SESSION_SECRET === process.env.MONGO_STORE_SECRET) {
        throw new Error('SESSION_SECRET and MONGO_STORE_SECRET must be different values.');
    }
}

function sessionCookieOptions(isProduction) {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
}

function configureDnsServers() {
    if (!process.env.DNS_SERVERS) return;

    const servers = process.env.DNS_SERVERS
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);

    if (!servers.length) {
        throw new Error('DNS_SERVERS must contain at least one DNS server address.');
    }

    dns.setServers(servers);
    console.log(`Configured ${servers.length} Node DNS resolver(s).`);
}

const scriptSrcUrls = [
    "https://api.tiles.mapbox.com/",
    "https://api.mapbox.com/",
];
const styleSrcUrls = [
    "https://api.mapbox.com/",
    "https://api.tiles.mapbox.com/"
];
const connectSrcUrls = [
    "https://api.mapbox.com/",
    "https://a.tiles.mapbox.com/",
    "https://b.tiles.mapbox.com/",
    "https://events.mapbox.com/"
];
const fontSrcUrls = [];

function createApp() {
    const userRoute = require('./routes/user');
    const campgroundRoute = require('./routes/campgrounds');
    const reviewRoute = require('./routes/reviews');
    const app = express();
    const isProduction = process.env.NODE_ENV === 'production';

    // Render terminates TLS at one proxy hop. Express must trust that hop so
    // secure session cookies recognize X-Forwarded-Proto: https.
    if (isProduction) app.set('trust proxy', 1);

    app.engine('ejs', ejsMate);
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // These defaults must exist even when session loading fails and Express
    // skips directly to the global error handler.
    app.use((req, res, next) => {
        res.locals.signedUser = null;
        res.locals.success = [];
        res.locals.error = [];
        next();
    });

    // Probes intentionally do not depend on session storage.
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/ready', (req, res) => {
        const isMongoReady = mongoose.connection.readyState === 1;
        res.status(isMongoReady ? 200 : 503).json({
            status: isMongoReady ? 'ready' : 'not ready',
            mongodb: isMongoReady ? 'connected' : 'disconnected'
        });
    });

    app.use(methodOverride('_method'));
    app.use(express.urlencoded({ extended: true }));
    app.use('/public', express.static(path.join(__dirname, 'public')));

    const sessionConfig = {
        name: 'valid',
        secret: process.env.SESSION_SECRET,
        store: MongoStore.create({
            client: mongoose.connection.getClient(),
            dbName: DATABASE_NAME,
            touchAfter: 24 * 3600,
            crypto: {
                secret: process.env.MONGO_STORE_SECRET
            }
        }),
        resave: false,
        saveUninitialized: false,
        cookie: sessionCookieOptions(isProduction)
    };
    app.use(session(sessionConfig));

    // Passport sessions require express-session to run first.
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    app.use(mongoSanitize());
    app.use(helmet());

    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                defaultSrc: [],
                connectSrc: ["'self'", ...connectSrcUrls],
                scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
                styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
                workerSrc: ["'self'", "blob:"],
                objectSrc: [],
                imgSrc: [
                    "'self'",
                    "blob:",
                    "data:",
                    "https://res.cloudinary.com/dxyhaq7se/"
                ],
                fontSrc: ["'self'", ...fontSrcUrls],
            },
        })
    );

    app.use((req, res, next) => {
        // Avoid creating an otherwise empty session just to read flash data.
        if (req.session.flash) {
            res.locals.success = req.flash('success');
            res.locals.error = req.flash('error');
        }
        res.locals.signedUser = req.user;
        next();
    });

    app.get('/', (req, res) => {
        res.render('home');
    });

    app.use('/', userRoute);
    app.use('/campgrounds', campgroundRoute);
    app.use('/campgrounds/:id/reviews', reviewRoute);

    app.all('*', (req, res) => {
        throw new ExpressError('Page Not Found', 404);
    });

    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || err.status || 500;
        if (!err.message) err.message = 'Oh No, Something Went Wrong!';

        // Log the original request failure before attempting to render a page.
        console.error(err);
        res.render('error', {
            err,
            statusCode,
            signedUser: res.locals.signedUser ?? null,
            success: res.locals.success ?? [],
            error: res.locals.error ?? []
        }, (renderError, html) => {
            if (renderError) {
                console.error('Error page rendering failed:', renderError);
                return res.status(500).type('text/plain').send('500 - Oh No, Something Went Wrong!');
            }
            res.status(statusCode).send(html);
        });
    });

    return app;
}

function listen(app, port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            server.off('error', reject);
            resolve(server);
        });
        server.once('error', reject);
    });
}

async function start() {
    validateEnvironment();
    configureDnsServers();

    const port = process.env.PORT || 8080;
    await mongoose.connect(process.env.DB_URL, { dbName: DATABASE_NAME });
    console.log(`MongoDB ready (database: ${DATABASE_NAME}).`);

    const app = createApp();
    await listen(app, port);
    console.log(`Kampit listening on port ${port}.`);
}

mongoose.connection.on('error', (err) => {
    console.error(`MongoDB connection error (${err.name}).`);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Readiness checks will fail until it reconnects.');
});

if (require.main === module) {
    start().catch((err) => {
        console.error(`Application startup failed (${err.name}): ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    configureDnsServers,
    createApp,
    sessionCookieOptions,
    start,
    validateEnvironment
};
