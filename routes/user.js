const express = require('express');
const users = require('../controllers/users')
const { catchAsync } = require('../utils/errorHandler');
const { redirectIfLoggedIn } = require('../utils/middlewares');
//might add Joi-validation later...

const router = express.Router();
const passport = require('passport');

router.route('/sign-up')
    .get(redirectIfLoggedIn, users.renderSignup)
    .post(redirectIfLoggedIn, catchAsync(users.signUp));
router.route('/login')
    .get(redirectIfLoggedIn, users.renderLogin)
    .post(redirectIfLoggedIn,
        passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }),
        users.login);
router.post('/sign-out', users.signout);

module.exports = router;