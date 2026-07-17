const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReviewSchema = new Schema({
    body: {
        type: String,
        required: [true, 'Review body is required.'],
        trim: true,
        maxlength: [2000, 'Review body cannot exceed 2000 characters.']
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required.'],
        min: [1, 'Rating must be at least 1.'],
        max: [5, 'Rating cannot exceed 5.'],
        validate: {
            validator: Number.isInteger,
            message: 'Rating must be a whole number.'
        }
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Review author is required.']
    }
}, { timestamps: true });

ReviewSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function enableUpdateValidators() {
    this.setOptions({ runValidators: true });
});

module.exports = mongoose.model('Review', ReviewSchema);
