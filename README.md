# Kampit

Kampit is an Express and EJS campground application backed by MongoDB Atlas, with Passport
authentication, MongoDB sessions, Mapbox maps, and Cloudinary-hosted images.

## Local verification

Use Node 24, as pinned by `.nvmrc` and `package.json`.

```powershell
npm ci
npm run build
npm test
npm run seed:verify
npm start
```

`npm run seed:verify` is read-only. It disables Mongoose collection and index creation and checks
the configured `Kampit` database against the committed GSB seed manifest. `npm run seed:gsb` is a
guarded write command for seed maintainers; it never performs a collection-wide deletion. See
[`seeds/gsb-camps/README.md`](seeds/gsb-camps/README.md) before using any seed command.
`npm run seed:images` and `npm run seed:dry` are optional maintainer checks that require the
ignored local source-image files; a clean production checkout does not need those files.

The compiled `public/styles/tailwind.css` remains tracked so a source checkout is styled even
before a build. Render should still run the production build to regenerate it deterministically.

## Render

- Runtime: Node 24
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Liveness path: `/health`
- Render health-check/readiness path: `/ready`
- Application bind: `0.0.0.0:$PORT`

Render must define these secret/environment variable names:

- `DB_URL` — an Atlas SRV URI whose database path is exactly `/Kampit`
- `SESSION_SECRET`
- `MONGO_STORE_SECRET` — must differ from `SESSION_SECRET`
- `MAPBOX_TOKEN`
- `CLOUDNAME`
- `CLOUDINARYKEY`
- `CLOUDINARYSECRET`

Render supplies `NODE_ENV=production` and `PORT`. `DNS_SERVERS` is optional and should be set only
when the platform resolver cannot resolve Atlas SRV records. Do not configure seed-only variables
on the web service unless intentionally running the guarded seed tooling from a separate task.

Copy `.env.example` to `.env` for local development and replace every placeholder. Never commit
the resulting `.env` file.

## Repository policy

The GSB manifest, review notes, verifier, tests, public assets, lockfile, Node pin, and compiled CSS
are source-controlled. Original seed JPEG/PNG files are local seed-maintainer inputs and are
ignored after upload to Cloudinary; only `source-images/README.md` is committed.
