# Safe GSB seed system

This directory is isolated from `scripts/seed-campgrounds.js`. The legacy script is never
imported, called, or adapted here. The new workflow performs no collection-wide deletion and
never creates reviews.

## Safety model

- `npm run seed:dry` validates every candidate through the real Mongoose `Campground` model
  before opening MongoDB. An incomplete dataset fails at that point and cannot upload images.
- A valid dry run connects to the `Kampit` database for read-only existence/collision checks.
- `npm run seed:gsb` additionally requires `SEED_CONFIRM_EXECUTE=Kampit/gsb-camps`.
- When `NODE_ENV=production` or `DB_URL` uses an Atlas-style `mongodb+srv` connection, execute
  mode also requires `SEED_CONFIRM_PRODUCTION=Kampit/gsb-camps/production`.
- Existing seed-managed records are skipped. An unmanaged record with the same seed key, title,
  or location pair causes a hard failure; it is never overwritten.
- Cloudinary assets use deterministic IDs in `kampit/seed/gsb-camps`, so reruns query and reuse
  an asset instead of uploading a duplicate.
- Every camp must have 1–4 reviewed images named `<seedKey>-01` through `<seedKey>-04`, with no
  numbering gaps.
- The image inventory hashes every source file and blocks byte-for-byte duplicates across camps.
- If a new upload is followed by an upload, schema, or Mongo insert failure, only the assets
  uploaded during that attempt are destroyed. A cleanup failure is reported separately.

## Dataset review

Review [DATA_REVIEW.md](./DATA_REVIEW.md), then complete `data/campgrounds.json`. Each image must
be placed under this directory (normally `source-images/`). A `documented-source` rights basis
requires an HTTPS provenance URL and attribution; a recorded owner confirmation may use
`user-confirmed-reuse-no-attribution`. Set a verification flag to `true` only after that field
has actually been checked. The validator uses GeoJSON/Mapbox coordinate order `[longitude, latitude]` and enforces
a broad Türkiye review boundary; this catches swapped or obviously unrelated values but does not
prove a coordinate is the camp entrance.

The reviewed data file contains 14 records and 30 local image paths. Camp details have been
filled from GSB material and facility-level map results. Image reuse without attribution was
confirmed by the project owner and stored in dataset metadata. See `DATA_REVIEW.md` for address,
coordinate, and evidence caveats.

### Manual image intake

Use official GSB or provincial directorate media, your own photography, or images for which the
rights holder has granted reuse permission. Do not scrape or rehost Google Maps listing photos.
Place the files in `source-images/` as `<seedKey>-01.jpg` and optionally `-02` through `-04`
(`.jpeg` and `.png` are also accepted). Then run:

```powershell
npm run seed:images
```

This read-only inventory reports missing files, numbering gaps, unknown filenames, duplicate
file contents, and rights metadata that still needs to be added to `data/campgrounds.json`.
Once the selected rights basis passes validation, the normal dry-run/execute workflow uploads
the files and captures Cloudinary's `public_id` and `secure_url` automatically.

## Environment variables

The app's existing names are reused:

- `DB_URL`
- `SESSION_SECRET` and `MONGO_STORE_SECRET` (distinct values required for app startup)
- `MAPBOX_TOKEN`
- `CLOUDNAME`, `CLOUDINARYKEY`, `CLOUDINARYSECRET` (execute only)

Seed-only values are:

- `SEED_AUTHOR_USERNAME` and `SEED_AUTHOR_EMAIL` (always required once the dataset is valid)
- `SEED_AUTHOR_PASSWORD` (required only when execute mode must create the author; minimum 16
  characters)
- `SEED_CONFIRM_EXECUTE` and, for production, `SEED_CONFIRM_PRODUCTION`

Do not commit these values. `.env` is already ignored. The password is passed directly to
`passport-local-mongoose`, which stores its derived hash and salt; plaintext is not written to
the dataset or database. On the first approved execute run, the script creates a user marked
`seedManaged: true` with seed key `gsb-camps-seed-author`. Later runs reuse only that exact
managed identity, and the password can be removed from the environment.

Example local dry run in PowerShell after the dataset passes review:

```powershell
$env:SEED_AUTHOR_USERNAME = 'gsb-camps'
$env:SEED_AUTHOR_EMAIL = 'seed-owner@example.org'
npm run seed:dry
```

Do not set the execute confirmations until the dry-run output and data table have been approved.
For an explicitly approved non-production run:

```powershell
$env:SEED_AUTHOR_PASSWORD = '<one-time-secret-from-a-password-manager>'
$env:SEED_CONFIRM_EXECUTE = 'Kampit/gsb-camps'
npm run seed:gsb
npm run seed:verify
```

Production needs the additional exact confirmation shown above. Nothing in this setup has run
either command against Atlas.

## Verification

`npm run seed:verify` is read-only, with Mongoose collection/index auto-creation disabled. It
reports total users, campgrounds, and reviews; campgrounds missing images or geometry; and
duplicate seed keys in both the user and campground collections.

## Rollback approach

There is deliberately no automatic rollback command. Before an approved first run, take an Atlas
snapshot/export. If a completed batch must be removed, first run verification and select only
records where `seedManaged === true` and `seedKey` is present in this dataset. Export those
documents, then remove them one at a time through `Campground.findOneAndDelete` so model cleanup
hooks run. Only after MongoDB deletion succeeds should the matching deterministic Cloudinary IDs
under `kampit/seed/gsb-camps/` be destroyed. Remove the seed author only if no campground still
references it. If users may already have posted reviews, review those relationships before any
rollback instead of deleting automatically.
