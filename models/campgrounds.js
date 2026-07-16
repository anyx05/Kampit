const mongoose = require("mongoose");
const Review = require("./reviews");
const Schema = mongoose.Schema;

const imageSchema = new Schema(
    {
        filename: {
            type: String,
            required: [true, 'Image filename is required.'],
            trim: true
        },
        url: {
            type: String,
            required: [true, 'Image URL is required.'],
            trim: true
        }
    },
    { _id: false }
);

imageSchema.virtual('thumbnail').get(function () {
    return this.url.replace('upload', 'upload/c_thumb,w_200');
});

const CampgroundSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Title is required.'],
        trim: true,
        maxlength: [120, 'Title cannot exceed 120 characters.']
    },
    images: {
        type: [imageSchema],
        validate: {
            validator: (images) => Array.isArray(images) && images.length > 0,
            message: 'At least one image is required.'
        }
    },
    price: {
        type: Number,
        required: [true, 'Price is required.'],
        min: [0, 'Price cannot be negative.'],
        max: [1000000, 'Price cannot exceed 1000000.']
    },
    description: {
        type: String,
        required: [true, 'Description is required.'],
        trim: true,
        maxlength: [5000, 'Description cannot exceed 5000 characters.']
    },
    location: {
        type: String,
        required: [true, 'Location is required.'],
        trim: true,
        maxlength: [200, 'Location cannot exceed 200 characters.']
    },
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: [true, 'Geometry type is required.']
        },
        coordinates: {
            type: [Number],
            required: [true, 'Geometry coordinates are required.'],
            validate: {
                validator: (coordinates) => (
                    Array.isArray(coordinates)
                    && coordinates.length === 2
                    && coordinates.every(Number.isFinite)
                    && coordinates[0] >= -180
                    && coordinates[0] <= 180
                    && coordinates[1] >= -90
                    && coordinates[1] <= 90
                ),
                message: 'Geometry coordinates must be [longitude, latitude] within valid ranges.'
            }
        }
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review"
        }
    ],
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, 'Campground author is required.']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

CampgroundSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function enableUpdateValidators() {
    this.setOptions({ runValidators: true });
});

CampgroundSchema.virtual('properties.map_popUp').get(function(){
    return `
        <h3><strong><a href="campgrounds/${this._id}">${this.title}</a></strong></h3>
        <p>${this.description.slice(0,30)}...</p>
    `;
})

CampgroundSchema.post('findOneAndDelete', async (doc) => {
    if (doc) {
        await Review.deleteMany({ _id: { $in: doc.reviews } });
    }
})

module.exports = mongoose.model("Campground", CampgroundSchema);
