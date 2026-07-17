if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const mongoose = require('mongoose');
const dataset = require('./data/campgrounds.json');
const User = require('../../models/user');
const Campground = require('../../models/campgrounds');
const { cloudinary } = require('../../utils/cloudinary_config');
const { configureDnsServers } = require('../../utils/dns');
const { ensureSeedAuthor } = require('./lib/author');
const {
    DATABASE_NAME,
    EXECUTE_CONFIRMATION,
    PRODUCTION_CONFIRMATION
} = require('./lib/constants');
const { seedRecords } = require('./lib/runner');
const { analyzeDataset, formatAnalysis } = require('./lib/validation');

function modeFromArguments(argumentsList) {
    const flags = argumentsList.filter((argument) => argument.startsWith('--'));
    if (flags.length !== 1 || !['--dry-run', '--execute'].includes(flags[0])) {
        throw new Error('Choose exactly one mode: --dry-run or --execute');
    }
    return flags[0] === '--dry-run' ? 'dry-run' : 'execute';
}

function assertExecuteConfirmed(environment) {
    const missingCloudinaryVariables = ['CLOUDNAME', 'CLOUDINARYKEY', 'CLOUDINARYSECRET']
        .filter((name) => !environment[name]?.trim());
    if (missingCloudinaryVariables.length) {
        throw new Error(`Execute mode is missing: ${missingCloudinaryVariables.join(', ')}`);
    }
    if (environment.SEED_CONFIRM_EXECUTE !== EXECUTE_CONFIRMATION) {
        throw new Error(`Execute mode requires SEED_CONFIRM_EXECUTE=${EXECUTE_CONFIRMATION}`);
    }
    const usesSrvConnection = /^mongodb\+srv:\/\//i.test(environment.DB_URL || '');
    if (
        (environment.NODE_ENV === 'production' || usesSrvConnection)
        && environment.SEED_CONFIRM_PRODUCTION !== PRODUCTION_CONFIRMATION
    ) {
        throw new Error(
            `Production or SRV execute mode also requires SEED_CONFIRM_PRODUCTION=${PRODUCTION_CONFIRMATION}`
        );
    }
}

function printResults(mode, authorAction, results) {
    const actionCounts = results.reduce((counts, result) => {
        counts[result.action] = (counts[result.action] || 0) + 1;
        return counts;
    }, {});
    console.log(JSON.stringify({ mode, author: authorAction, campgrounds: actionCounts }, null, 2));
}

async function main() {
    const mode = modeFromArguments(process.argv.slice(2));
    const dryRun = mode === 'dry-run';
    if (!dryRun) assertExecuteConfirmed(process.env);

    const analysis = await analyzeDataset(dataset);
    console.log(`Validated ${analysis.recordResults.length} seed candidate(s) through the Campground schema.`);
    if (!analysis.valid) {
        console.error(formatAnalysis(analysis));
        throw new Error('Dataset review is incomplete; no database or Cloudinary connection was opened');
    }

    if (!process.env.DB_URL) throw new Error('DB_URL is required');
    configureDnsServers();
    await mongoose.connect(process.env.DB_URL, {
        dbName: DATABASE_NAME,
        autoCreate: !dryRun,
        autoIndex: !dryRun
    });
    if (mongoose.connection.db.databaseName !== DATABASE_NAME) {
        throw new Error(`Connected to unexpected database ${mongoose.connection.db.databaseName}`);
    }
    if (!dryRun) await Promise.all([User.init(), Campground.init()]);

    const { author, action: authorAction } = await ensureSeedAuthor({ dryRun });
    const results = await seedRecords({
        dataset,
        analysis,
        authorId: author._id,
        dryRun,
        cloudinaryClient: dryRun ? undefined : cloudinary
    });
    printResults(mode, authorAction, results);
}

if (require.main === module) {
    main()
        .catch((error) => {
            console.error(`GSB seed failed: ${error.message}`);
            if (error.cleanupError) console.error(`Compensation also failed: ${error.cleanupError.message}`);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        });
}

module.exports = { assertExecuteConfirmed, main, modeFromArguments };
