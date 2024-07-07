document.addEventListener('DOMContentLoaded', function() {
    const allImages = document.querySelectorAll('img');
    const spinnerContainer = document.querySelector('.spinner-container');

    let imagesLoaded = 0;

    function checkAllImagesLoaded() {
        imagesLoaded++;
        if (imagesLoaded === allImages.length) {
            spinnerContainer.style.display = 'none';
        }
    }

    allImages.forEach(img => {
        img.setAttribute('loading', 'lazy');
        if (img.complete) {
            checkAllImagesLoaded();
        } else {
            img.addEventListener('load', checkAllImagesLoaded);
        }
    });
});






















const videosPerPage = 15; // Afficher 15 vidéos par page
let currentPage = 1;
let totalVideos = document.querySelectorAll('.video').length;
let totalPages = Math.ceil(totalVideos / videosPerPage);

function displayVideos(page) {
    const videos = document.querySelectorAll('.video');
    videos.forEach((video, index) => {
        if (index >= (page - 1) * videosPerPage && index < page * videosPerPage) {
            video.style.display = 'block';
        } else {
            video.style.display = 'none';
        }
    });
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        displayVideos(currentPage);
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayVideos(currentPage);
    }
}


    // Affiche la première page de vidéos au chargement
    displayVideos(currentPage);

        
        function choisirLienAleatoire() {
            // Obtenir tous les liens de la page
            var liens = Array.from(document.getElementsByTagName("a")); // Convertit la collection en tableau
            
            // Choisir un lien au hasard
            var lienAleatoire = liens[Math.floor(Math.random() * liens.length)];
            
            // Naviguer vers le lien choisi
            window.open(lienAleatoire.href, '_blank');
        }
        