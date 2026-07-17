# GSB campground seed review

This is the pre-execution review for dataset `2026-07-official-review-2`. It contains the 14
camps that have local source images. Trabzon Doğu Karadeniz was removed because no reviewed
images were supplied. No legacy IDs, reviews, Cloudinary references, or destructive operations
were carried forward.

## Expected MongoDB document shape

```js
{
  title: String,
  images: [{ // 1–4 images per seed-managed campground
    filename: "kampit/seed/gsb-camps/<seedKey>-01", // Cloudinary public_id
    url: "https://res.cloudinary.com/..."          // Cloudinary secure_url
  }],
  price: 0, // no nightly fee; this is an application-based GSB program
  description: String,
  location: String,
  geometry: { type: "Point", coordinates: [longitude, latitude] },
  reviews: [],
  author: ObjectId,
  seedKey: String,
  seedManaged: true,
  seedMetadata: {
    dataset: "gsb-camps",
    version: String,
    sourceUrls: [String],
    imageSources: [{ sourcePath: String, sourceUrl: String | null, attribution: String | null }],
    imageRightsDeclaration: {
      basis: "user-confirmed-reuse-no-attribution",
      confirmedAt: Date,
      confirmationNote: String
    },
    verification: {
      identity: true,
      location: true,
      coordinates: true,
      content: true,
      pricing: true,
      imageRights: true
    },
    notes: String,
    lastSeededAt: Date
  }
}
```

The real `Campground` model requires a title, at least one `{ filename, url }` image, a
non-negative numeric price, description, location, GeoJSON Point geometry, and author. The seed
adds stable ownership/provenance fields. Coordinates use Mapbox/GeoJSON order: longitude first,
latitude second.

## Execution readiness and caveats

The 30 local files are linked to their campground records, use contiguous `01`–`04` numbering,
and have unique SHA-256 hashes. On 2026-07-17 the project owner confirmed that the images are
privately taken or otherwise reusable without a source-page or attribution requirement. That
confirmation is stored as a dataset-level rights declaration and all `imageRights` flags are
approved. Future sourced images can instead use the stricter `documented-source` basis, which
requires an HTTPS source URL and attribution for every file.

Mersin Maliye's current operation is supported by 2026 GSB transport procurement İKN
`2026/937751` and a government-university camp allocation document. No direct current facility
profile was found, so that evidence limitation remains in the record notes but no longer blocks
the identity check.

All facility pins were reviewed against facility-level map results on 2026-07-17 and pass the
schema/Türkiye coordinate checks. They have not been field-verified as exact entrances. Two
address differences are preserved in record notes: Mersin 23 Nisan (`180/A` official versus
`181A` on the map provider) and Osmaniye Aslantaş (official Kızyusuflu/Siteler versus the map
provider's neighboring Bahadırlı label).

`price: 0` represents an application-based GSB program with no nightly charge, not public
walk-in lodging. The campground detail view now labels seed-managed records accordingly instead
of rendering `$0/night`.

## Reviewable records

| # | Seed key | Camp | Address | Images | Review status |
|---:|---|---|---|---:|---|
| 1 | `gsb-aydin-efeler` | Aydın Efeler | Davutlar, Kuşadası, Aydın | 3 | Ready |
| 2 | `gsb-samsun-19-mayis` | Samsun 19 Mayıs | Dereköy, 19 Mayıs, Samsun | 2 | Ready |
| 3 | `gsb-hatay-arsuz-ulucinar` | Hatay Arsuz Uluçınar | Gözcüler, Arsuz, Hatay | 1 | Ready |
| 4 | `gsb-mersin-silifke-akkum` | Mersin Silifke Akkum | Atayurt, Silifke, Mersin | 4 | Ready |
| 5 | `gsb-mersin-mehmet-akif-ersoy` | Mersin Mehmet Akif Ersoy | Atakent, Silifke, Mersin | 2 | Ready |
| 6 | `gsb-mersin-silifke-23-nisan` | Mersin Silifke 23 Nisan | Kapızlı, Silifke, Mersin | 1 | Ready; address discrepancy noted |
| 7 | `gsb-mersin-maliye` | Mersin Maliye | Gaziçiftliği, Silifke, Mersin | 2 | Ready; evidence limitation noted |
| 8 | `gsb-kocaeli-kefken` | Kocaeli Kefken | Kefken, Kandıra, Kocaeli | 2 | Ready |
| 9 | `gsb-bursa-karacaali` | Bursa Karacaali | Karacaali, Gemlik, Bursa | 3 | Ready |
| 10 | `gsb-antalya-alaaddin-keykubat` | Antalya Alaaddin Keykubat | Yeşilbayır, Döşemealtı, Antalya | 1 | Ready; street/entrance caveat noted |
| 11 | `gsb-kastamonu-yolkonak` | Kastamonu Yolkonak | Yolkonak, Kastamonu Merkez | 2 | Ready |
| 12 | `gsb-osmaniye-aslantas` | Osmaniye Aslantaş | Kızyusuflu/Siteler, Kadirli | 3 | Ready; address discrepancy noted |
| 13 | `gsb-kirsehir-ahi-evran` | Kırşehir Ahi Evran | Hirfanlı Barajı, Kaman | 2 | Ready |
| 14 | `gsb-manisa-sehzadeler` | Manisa Şehzadeler | Sarıağa, Kırkağaç, Manisa | 2 | Ready; precise entrance caveat noted |
