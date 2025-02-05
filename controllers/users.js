const User = require('../models/user');

module.exports.renderSignup = (req, res) => {
    res.render('user/signup');
}
module.exports.signUp = async (req, res, next) => {
    const { username, email, password } = req.body;
    const user = new User({ username, email });

    try {
        const authUser = await User.register(user, password);
        req.login(authUser, err => {
            if (err) return next(err);
            req.flash('success', `Welcome @${authUser.username} it's time to explore!`);
            const redirectUrl = res.locals.returnTo || '/campgrounds';
            res.redirect(redirectUrl);
        })
    } catch (e) {
        console.error(e);
        if (e.message.includes('username')) {
            req.flash('error', 'Username already exists.');
        } else if (e.message.includes('email')) {
            req.flash('error', 'Email is already registered.');
        } else {
            req.flash('error', 'An unexpected error occurred. Please try again.');
        }
        res.redirect('/sign-up');
    }
}
module.exports.renderLogin = (req, res) => {
    res.render('user/login');
}
module.exports.login = async (req, res) => {
    const username = req.body.username.toLowerCase();
    const user = await User.findOne({ $or: [{ username: username }, { email: username }] });
    req.flash('success', `Welcome back ${user.username}!`);
    const redirectUrl = res.locals.returnTo || '/campgrounds';
    res.redirect(redirectUrl);
}
module.exports.signout = (req, res) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success', 'Sign out successful!');
        res.redirect('/campgrounds'); //might change this and some other to home-page
    });
}