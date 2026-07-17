const mongoose = require('mongoose');
const User = require('../../../models/user');
const { AUTHOR_SEED_KEY } = require('./constants');

function requiredIdentity(environment) {
    const username = environment.SEED_AUTHOR_USERNAME?.trim().toLowerCase();
    const email = environment.SEED_AUTHOR_EMAIL?.trim().toLowerCase();
    const missing = [];
    if (!username) missing.push('SEED_AUTHOR_USERNAME');
    if (!email) missing.push('SEED_AUTHOR_EMAIL');
    if (missing.length) throw new Error(`Missing seed author environment variables: ${missing.join(', ')}`);
    return { username, email };
}

function defaultAuthorRepository(UserModel) {
    return {
        findBySeedKey: (seedKey) => UserModel.findOne({ seedKey }),
        findIdentityCollision: ({ username, email }) => UserModel.findOne({ $or: [{ username }, { email }] }),
        create: ({ username, email, password }) => UserModel.register(new UserModel({
            username,
            email,
            seedKey: AUTHOR_SEED_KEY,
            seedManaged: true
        }), password)
    };
}

async function ensureSeedAuthor(options = {}) {
    const {
        dryRun,
        environment = process.env,
        UserModel = User,
        repository = defaultAuthorRepository(UserModel)
    } = options;
    const identity = requiredIdentity(environment);

    const proposedAuthor = new UserModel({
        ...identity,
        seedKey: AUTHOR_SEED_KEY,
        seedManaged: true
    });
    await proposedAuthor.validate();

    const existing = await repository.findBySeedKey(AUTHOR_SEED_KEY);
    if (existing) {
        if (
            existing.seedManaged !== true
            || existing.username !== identity.username
            || existing.email !== identity.email
        ) {
            throw new Error('The seed author key exists but its managed flag or identity does not match');
        }
        return { author: existing, action: 'reused' };
    }

    const collision = await repository.findIdentityCollision(identity);
    if (collision) {
        throw new Error('Seed author username or email belongs to an account not marked with the seed author key');
    }

    if (dryRun) {
        proposedAuthor._id = proposedAuthor._id || new mongoose.Types.ObjectId();
        return { author: proposedAuthor, action: 'would-create' };
    }

    const password = environment.SEED_AUTHOR_PASSWORD;
    if (typeof password !== 'string' || password.length < 16) {
        throw new Error('SEED_AUTHOR_PASSWORD must contain at least 16 characters when creating the seed author');
    }
    const created = await repository.create({ ...identity, password });
    return { author: created, action: 'created' };
}

module.exports = { ensureSeedAuthor, requiredIdentity };
