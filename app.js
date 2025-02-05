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
const path = require('path');
const methodOverride = require('method-override');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');

const { ExpressError } = require('./utils/errorHandler');
const userRoute = require('./routes/user');
const campgroundRoute = require('./routes/campgrounds');
const reviewRoute = require('./routes/reviews');
const User = require('./models/user'); //used by passport


const dbUrl = process.env.DB_URL;

async function main() {
    await mongoose.connect(dbUrl);
}
main().catch(err => console.log(err));
mongoose.connection.on('error', err => {
    console.log(err);
});

const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(methodOverride('_method'))
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

const secret = process.env.SECRET
const sessionConfig = {
    name:'valid',
    secret: secret,
    store: MongoStore.create({
        mongoUrl: dbUrl,
        touchAfter: 24*3600,
        crypto:{
            secret: secret
        }
    }),
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure:true,
        maxAge: 604800000 //(ms)
    }
}
app.use(session(sessionConfig));
app.use(flash());
app.use(mongoSanitize());
app.use(helmet());

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

//passport-related
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    if (!['/sign-up', '/login', '/'].includes(req.originalUrl)) {
        if (req.originalUrl) {
            if (req.originalUrl.includes('/reviews')) {
                req.originalUrl = req.originalUrl.substring(0, req.originalUrl.indexOf('/reviews'));
            }
            req.session.returnTo = req.originalUrl;
        }
    }
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.signedUser = req.user;
    next();
})

app.get('/', (req, res) => {
    res.render('home');
})

app.use('/', userRoute);
app.use('/campgrounds', campgroundRoute);
app.use('/campgrounds/:id/reviews', reviewRoute);

app.all('*', (req, res) => {
    throw new ExpressError('Page Not Found', 404)
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    console.log(err)
    res.status(statusCode).render('error', { err, statusCode });
})

app.listen(8080, () => {
    console.log('listening on port 8080!');
})