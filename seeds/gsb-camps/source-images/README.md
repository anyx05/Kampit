# Seed source images

JPEG and PNG files in this directory are local seed-maintainer inputs and are intentionally
ignored by Git. They are not needed by the deployed application or by `npm run seed:verify`.
Keep a licensed private copy if the dataset may need to be uploaded again.

Place 1–4 reviewed, licensed JPEG or PNG source files per camp in this directory. Use the
camp's exact seed key followed by contiguous two-digit numbering:

```text
gsb-aydin-efeler-01.jpg
gsb-aydin-efeler-02.jpg
gsb-aydin-efeler-03.png
```

Run `npm run seed:images` to inventory the files. Reference each file from
`data/campgrounds.json` with a relative path. With the dataset-level
`user-confirmed-reuse-no-attribution` declaration, URL and attribution may be null:

```json
{
  "sourcePath": "source-images/gsb-aydin-efeler-01.jpg",
  "sourceUrl": null,
  "attribution": null
}
```

For future images using `documented-source`, both fields must instead contain the HTTPS source
page and attribution. The seed validator rejects zero or more than 4 images, numbering gaps,
missing files, invalid rights declarations, and path traversal. The inventory also rejects
byte-for-byte duplicate image contents. Do not upload an image until its reuse rights have been
reviewed.
