//nav toggler
const toggler = document.querySelector('#toggler');
const navigation = document.querySelector('nav ul');
toggler.addEventListener('click', () => {
    navigation.classList.toggle('hidden');
})

//dismiss flash-message
const success = document.querySelector('#toast-success');
const dismiss_success = document.querySelector('#dismiss-success');
const warning = document.querySelector('#toast-warning');
const dismiss_warning = document.querySelector('#dismiss-warning');
const dismiss = (flash_element, dismiss_btn) => {
    setTimeout(() => {
        flash_element.classList.add('dismiss');
        flash_element.addEventListener('transitionend', () => {
            flash_element.remove();
        });
    }, 5000);
    dismiss_btn.addEventListener('click', () => {
        flash_element.classList.add('dismiss');
        flash_element.addEventListener('transitionend', () => {
            flash_element.remove();
        });
    });
}
if (success) {
    dismiss(success, dismiss_success);
}
if (warning) {
    dismiss(warning, dismiss_warning);
}

document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('nav a');

    links.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath && currentPath !== '/') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

//delete Images in edit page
document.querySelectorAll('.imageList').forEach((imageContainer) => {
    const deleteButton = imageContainer.querySelector('button');
    deleteButton.addEventListener('click', function (e) {
        e.preventDefault();
        const hiddenInput = imageContainer.querySelector('.deleted-image-input');
        const image = imageContainer.querySelector('img');
        hiddenInput.value = image.id;
        imageContainer.classList.add("hidden"); // Hide the image container
    });
});

