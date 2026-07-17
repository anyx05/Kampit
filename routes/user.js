const express = require('express');
const users = require('../controllers/users')
const { catchAsync } = require('../utils/errorHandler');
const { redirectIfLoggedIn } = require('../utils/middlewares');
const { loadReturnTo } = require('../utils/auth');

const router = express.Router();
const passport = require('passport');

router.route('/sign-up')
    .get(redirectIfLoggedIn, users.renderSignup)
    .post(redirectIfLoggedIn, loadReturnTo, catchAsync(users.signUp));
router.route('/login')
    .get(redirectIfLoggedIn, users.renderLogin)
    .post(redirectIfLoggedIn,
        loadReturnTo,
        passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }),
        catchAsync(users.login));
router.post('/sign-out', catchAsync(users.signout));

module.exports = router;
