const User = require('../models/user');
const { consumeReturnTo } = require('../utils/auth');

function loginUser(req, user) {
    return new Promise((resolve, reject) => {
        req.login(user, (err) => err ? reject(err) : resolve());
    });
}

function logoutUser(req) {
    return new Promise((resolve, reject) => {
        req.logout((err) => err ? reject(err) : resolve());
    });
}

module.exports.renderSignup = (req, res) => {
    res.render('user/signup');
}
module.exports.signUp = async (req, res) => {
    const { username, email, password } = req.body;
    const user = new User({ username, email });
    let authUser;

    try {
        authUser = await User.register(user, password);
    } catch (e) {
        console.warn(`User registration failed (${e.name || 'Error'}).`);
        if (e.message?.includes('username')) {
            req.flash('error', 'Username already exists.');
        } else if (e.message?.includes('email')) {
            req.flash('error', 'Email is already registered.');
        } else {
            req.flash('error', 'An unexpected error occurred. Please try again.');
        }
        return res.redirect('/sign-up');
    }

    await loginUser(req, authUser);
    req.flash('success', `Welcome @${authUser.username} it's time to explore!`);
    res.redirect(consumeReturnTo(req, res));
}
module.exports.renderLogin = (req, res) => {
    res.render('user/login');
}
module.exports.login = async (req, res) => {
    req.flash('success', `Welcome back ${req.user.username}!`);
    res.redirect(consumeReturnTo(req, res));
}
module.exports.signout = async (req, res) => {
    await logoutUser(req);
    req.flash('success', 'Sign out successful!');
    res.redirect('/campgrounds');
}
