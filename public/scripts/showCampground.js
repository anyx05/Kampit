//media-resource toggle
document.querySelector(".icon-controller").addEventListener('click', () => {
    document.querySelector(".show-map").classList.toggle('hidden');
    document.querySelector(".show-carousel").classList.toggle('hidden');
    document.querySelector("#map").classList.toggle('hidden');
    document.querySelector(".carousel").classList.toggle('hidden');
})

//LocationMap
mapboxgl.accessToken = mapToken;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: coordinates,
    zoom: 9
});
map.addControl(new mapboxgl.NavigationControl());
const marker = new mapboxgl.Marker({ color: 'red' })
    .setLngLat(coordinates)
    .addTo(map);

//carousel
const slides = document.querySelectorAll('.carousel-item');
let currentSlide = 0;
let autoSlideInterval;

slides[currentSlide].classList.remove('opacity-0');
slides[currentSlide].classList.add('opacity-100');
const changeSlide = () => {
    slides[currentSlide].classList.remove('opacity-100');
    slides[currentSlide].classList.add('opacity-0');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('opacity-100');
    slides[currentSlide].classList.remove('opacity-0');
}

const resetInterval = () => {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(changeSlide, 3000);
};

const prevBtn = document.querySelector('[data-carousel-prev]');
const nextBtn = document.querySelector('[data-carousel-next]');
if(prevBtn && nextBtn){
    prevBtn.addEventListener('click', () => {
        slides[currentSlide].classList.remove('opacity-100');
        slides[currentSlide].classList.add('opacity-0');
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        slides[currentSlide].classList.add('opacity-100');
        slides[currentSlide].classList.remove('opacity-0');
        resetInterval();
    });
    nextBtn.addEventListener('click', () => {
        slides[currentSlide].classList.remove('opacity-100');
        slides[currentSlide].classList.add('opacity-0');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('opacity-100');
        slides[currentSlide].classList.remove('opacity-0');
        resetInterval();
    });
}

if (slides.length) {
    autoSlideInterval = setInterval(changeSlide, 3000);
}

//reviews side toggler
const comment_btn = document.querySelectorAll('.comment-btn');
const comment_options = document.querySelectorAll('.comment-options');
for (let i = 0; i < comment_btn.length; i++) {
    comment_btn[i].addEventListener('click', (event) => {
        event.stopPropagation();
        for (let j = 0; j < comment_btn.length; j++) {
            if (comment_options[j] !== comment_options[i]) {
                comment_options[j].classList.add('hidden');
            }
        }
        comment_options[i].classList.toggle('hidden');
    });
}
document.addEventListener('click', () => {
    for (let j = 0; j < comment_options.length; j++) {
        comment_options[j].classList.add('hidden');
    }
});
