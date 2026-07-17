const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../helpers/http');
const { applyTestEnvironment } = require('../helpers/test-environment');

applyTestEnvironment();

const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const Campground = require('../../models/campgrounds');
const { createApp, validateEnvironment } = require('../../app');

test('application constructs and serves its health endpoint without external services', async () => {
    const originalGetClient = mongoose.connection.getClient;
    const originalMongoStoreCreate = MongoStore.create;
    mongoose.connection.getClient = () => ({});
    MongoStore.create = () => new session.MemoryStore();

    try {
        assert.doesNotThrow(validateEnvironment);
        const response = await request(createApp(), '/health');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
    } finally {
        mongoose.connection.getClient = originalGetClient;
        MongoStore.create = originalMongoStoreCreate;
    }
});

test('readiness is unavailable until MongoDB reports a connected state', async () => {
    const originalGetClient = mongoose.connection.getClient;
    const originalMongoStoreCreate = MongoStore.create;
    mongoose.connection.getClient = () => ({});
    MongoStore.create = () => new session.MemoryStore();

    try {
        const response = await request(createApp(), '/ready');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
            status: 'not ready',
            mongodb: 'disconnected'
        });
    } finally {
        mongoose.connection.getClient = originalGetClient;
        MongoStore.create = originalMongoStoreCreate;
    }
});

test('unexpected route failures render a generic 500 page without exposing internal details', async () => {
    const originalGetClient = mongoose.connection.getClient;
    const originalMongoStoreCreate = MongoStore.create;
    const originalCampgroundFind = Campground.find;
    const originalConsoleError = console.error;
    mongoose.connection.getClient = () => ({});
    MongoStore.create = () => new session.MemoryStore();
    Campground.find = async () => {
        throw new Error('private-database-internal-detail');
    };
    console.error = () => {};

    try {
        const response = await request(createApp(), '/campgrounds');
        const html = await response.text();
        assert.equal(response.status, 500);
        assert.match(html, /Something Went Wrong/);
        assert.doesNotMatch(html, /private-database-internal-detail/);
    } finally {
        mongoose.connection.getClient = originalGetClient;
        MongoStore.create = originalMongoStoreCreate;
        Campground.find = originalCampgroundFind;
        console.error = originalConsoleError;
    }
});
