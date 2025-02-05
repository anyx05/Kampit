const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDNAME,
    api_key: process.env.CLOUDINARYKEY,
    api_secret: process.env.CLOUDINARYSECRET
})

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Kampit',
        allowedFormats: ['png', 'jpeg', 'jpg']
    }
});

module.exports = {
    cloudinary,
    storage
}