const mongoose = require('mongoose');
const Campground = require('../models/campgrounds');

main().catch(err => console.log(err));
async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/yelpCamp');
}

const camps = [
    {
        title: 'Aydın Efeler Gençlik Kampı',
        location: 'Kuşadası Davutlar, Aydın.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 31.6,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Samsun 19 Mayıs Gençlik Kampı',
        location: 'Dereköy, Ondokuzmayıs, Samsun.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 18,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Hatay Arsuz Uluçınar Gençlik Kampı',
        location: 'Arsuz district, Hatay.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 35.85,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Mersin Silifke Akkum Gençlik Kampı',
        location: 'Akkum, Silifke district, Mersin.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 23.95,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Mersin Mehmet Akif Ersoy Gençlik Kampı',
        location: 'Atayurt, Mersin.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 29.9,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Mersin Silifke 23 Nisan Gençlik Kampı',
        location: 'Kapizli area, Silifke district, Mersin.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 34.15,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Mersin Maliye Gençlik Kampı',
        location: 'Gaziçiftliği area, Silifke, Mersin.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 32.45,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Kocaeli Kefken Gençlik Kampı',
        location: 'Kandıra district, Kocaeli.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 27.35,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Bursa Karacaali Gençlik Kampı',
        location: 'Gemlik district, Bursa.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 35,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Antalya Alaaddin Keykubat Gençlik Kampı',
        location: 'Yeşilbayır, Döşemealtı, Antalya.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 20.55,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Trabzon Doğu Karadeniz Gençlik Kampı',
        location: 'Haçkalı Baba, Düzköy District, Trabzon.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 28.2,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Kastamonu Yolkonak Gençlik Kampı',
        location: 'Kadıdağı Yaylası area, Kastamonu.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 23.1,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Osmaniye Aslantaş Gençlik Kampı',
        location: 'Kadirli district, Osmaniye.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 37.55,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Kırşehir Ahi Evran Gençlik Kampı',
        location: 'Ahievran, Kırşehir.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 24.8,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Manisa Şehzadeler Gençlik Kampı',
        location: 'Sarıağa, Kırkağaç, Manisa.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 29.05,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Samsun Nebiyan Doğa Kampı',
        location: 'Nebiyan Plateau, Samsun.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 18.85,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Rize Fındıklı Gençlik Kampı',
        location: 'Fındıklı District, Rize.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 25.65,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'İstanbul Marmaracık Gençlik Kampı',
        location: 'Black Sea Coast, Istanbul.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 38.4,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Konya Beyşehir Gençlik Kampı',
        location: 'Lake Beyşehir, Konya.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 19.7,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Sakarya Arifiye Gençlik Kampı',
        location: 'Arifiye, Sakarya.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 26.5,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Ankara Çamkoru Gençlik Kampı',
        location: 'Ankara Çamlıdere, Ankara.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 22.25,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Manisa Kula Gençlik Kampı',
        location: 'Kula, Manisa.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 40,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Bitlis Ahlat Gençlik Kampı',
        location: 'Ahlat, Bitlis.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 33.3,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Gaziantep Şahinbey Gençlik Kampı',
        location: 'Sahinbey, Gaziantep.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 30.75,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Afyonkarahisar Sultandağı Gençlik Kampı',
        location: 'Sultandağı, Afyonkarahisar.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 21.4,
        author: '66ec5f4a8d58dce296955dbb'
    },
    {
        title: 'Samsun-Ladik Akdağ Doğa ve İzcilik Gençlik Kampı',
        location: 'Akdağ plateau, Samsun.',
        description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt, amet dolore. Ab officiis saepe ipsa aliquid deleniti provident voluptatibus consectetur voluptatum obcaecati consequatur architecto quos non, beatae quaerat cupiditate tempore!',
        price: 36.7,
        author: '66ec5f4a8d58dce296955dbb'
    }
]

const coordinates = [
    { type: 'Point', coordinates: [27.290706, 37.757119] },
    { type: 'Point', coordinates: [36.11815, 41.475424] },
    { type: 'Point', coordinates: [35.886536, 36.412569] },
    { type: 'Point', coordinates: [34.056781, 36.350291] },
    { type: 'Point', coordinates: [34.030028, 36.382192] },
    { type: 'Point', coordinates: [33.92609, 36.377823] },
    { type: 'Point', coordinates: [33.92609, 36.377823] },
    { type: 'Point', coordinates: [30.152687, 41.06958] },
    { type: 'Point', coordinates: [29.1554, 40.4315] },
    { type: 'Point', coordinates: [30.600277, 36.989883] },
    { type: 'Point', coordinates: [39.425137, 40.874077] },
    { type: 'Point', coordinates: [78.510755, 30.379013] },
    { type: 'Point', coordinates: [36.0979, 37.37027] },
    { type: 'Point', coordinates: [34.16008, 39.145798] },
    { type: 'Point', coordinates: [27.673277, 39.10577] },
    { type: 'Point', coordinates: [18.128778, -0.739074] },
    { type: 'Point', coordinates: [40.469479, 40.905258] },
    { type: 'Point', coordinates: [-70.61499, 43.261648] },
    { type: 'Point', coordinates: [31.72494, 37.67806] },
    { type: 'Point', coordinates: [30.361849, 40.713585] },
    { type: 'Point', coordinates: [32.849528, 39.955325] },
    { type: 'Point', coordinates: [28.644747, 38.54433] },
    { type: 'Point', coordinates: [42.47638, 38.750328] },
    { type: 'Point', coordinates: [5.813919, 51.836704] },
    { type: 'Point', coordinates: [31.230072, 38.531612] },
    { type: 'Point', coordinates: [18.128778, -0.739074] }
]

let i = 0;
for (let camp of camps) {
    camp.images = [{ filename: "Kampit/ihzz7cwqv7rudpxefb3r.jpg", url: "https://res.cloudinary.com/dxyhaq7se/image/upload/v1734978856/Kampit/ihzz7cwqv7rudpxefb3r.jpg" }];
    camp.geometry = coordinates[i];
    i++;
}

Campground.deleteMany({}).then(() => {
    console.log("successfully cleared campgrounds collection");
    Campground.insertMany(camps).then(() => {
        console.log("successfully added seed campgrounds");
        mongoose.connection.close();
    });
})

