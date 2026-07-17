if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../../models/user');
const Campground = require('../../models/campgrounds');
const Review = require('../../models/reviews');
const { configureDnsServers } = require('../../utils/dns');
const { DATABASE_NAME } = require('./lib/constants');
const { buildVerificationReport } = require('./lib/verification');
const dataset = require('./data/campgrounds.json');

async function main() {
    if (!process.env.DB_URL) throw new Error('DB_URL is required');
    configureDnsServers();
    await mongoose.connect(process.env.DB_URL, {
        dbName: DATABASE_NAME,
        autoCreate: false,
        autoIndex: false
    });
    if (mongoose.connection.db.databaseName !== DATABASE_NAME) {
        throw new Error(`Connected to unexpected database ${mongoose.connection.db.databaseName}`);
    }
    const report = await buildVerificationReport({ User, Campground, Review, dataset });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) throw new Error('Seeded data did not pass verification');
}

if (require.main === module) {
    main()
        .catch((error) => {
            console.error(`Seed verification failed: ${error.message}`);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        });
}

module.exports = { main };
