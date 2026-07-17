const TEST_ENVIRONMENT = Object.freeze({
    NODE_ENV: 'test',
    DB_URL: 'mongodb://127.0.0.1:27017/Kampit',
    SESSION_SECRET: 'test-session-secret',
    MONGO_STORE_SECRET: 'test-store-secret',
    MAPBOX_TOKEN: 'pk.eyJ1IjoidGVzdCJ9.test',
    CLOUDNAME: 'test-cloud',
    CLOUDINARYKEY: 'test-cloudinary-key',
    CLOUDINARYSECRET: 'test-cloudinary-secret'
});

function applyTestEnvironment() {
    Object.assign(process.env, TEST_ENVIRONMENT);
}

module.exports = { applyTestEnvironment, TEST_ENVIRONMENT };
