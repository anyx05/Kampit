const mongoose = require("mongoose");
const Review = require("./reviews");
const { required } = require("joi");
const Schema = mongoose.Schema;

const imageSchema = new Schema(
    {
        filename: String,
        url: String
    }
);

imageSchema.virtual('thumbnail').get(function () {
    return this.url.replace('upload', 'upload/c_thumb,w_200');
});

const CampgroundSchema = new Schema({
    title: String,
    images: [imageSchema],
    price: String,
    description: String,
    location: String,
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
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
        ref: "User"
    }
}, {toJSON: { virtuals: true }});

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