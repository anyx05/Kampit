const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new Schema({
    username: {
        type: String,
        required: [true, 'Username is required.'],
        trim: true,
        lowercase: true,
        minlength: [3, 'Username must be at least 3 characters.'],
        maxlength: [30, 'Username cannot exceed 30 characters.'],
        unique: true
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        trim: true,
        lowercase: true,
        maxlength: [320, 'Email cannot exceed 320 characters.'],
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be valid.'],
        unique: true
    }
}, { timestamps: true });

UserSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function enableUpdateValidators() {
    this.setOptions({ runValidators: true });
});

UserSchema.plugin(passportLocalMongoose, { usernameLowerCase: true, usernameQueryFields: ['email'] });
module.exports = mongoose.model('User', UserSchema);
