document.getElementById("file").addEventListener("change", (e) => {
    /**@type {File} */
    const file = e.target.files[0];   
    showPreviewImage(file)
})

function showPreviewImage(/**@type {File}*/file) {
    const url = URL.createObjectURL(file);
    
    const img = document.createElement("img");
    img.src = url;
    img.classList.add("previewImage");
    
    img.addEventListener("click", () => {
        lightboxImage.src = img.src;
        lightbox.classList.add("attivo");
    });

    document.getElementById("preview").appendChild(img);
    document.getElementById("preview").style.display = "grid";

    document.getElementById("formButton").style.display = "flex";
    document.getElementById("label").style.display = "none";
    
    aggiornaGriglia();
}
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");

// Aggiungi listener a ogni immagine della griglia
document.querySelectorAll(".previewImage").forEach(img => {
    img.addEventListener("click", () => {
        lightboxImage.src = img.src;
        lightbox.classList.add("attivo");
    });
});

// Chiudi cliccando fuori
lightbox.addEventListener("click", () => {
    lightbox.classList.remove("attivo");
});

function aggiornaGriglia() {
    const preview = document.getElementById("preview");
    const immagini = preview.querySelectorAll(".previewImage").length;

    if (immagini === 1) {
        preview.style.gridTemplateColumns = "1fr";
    } else {
        preview.style.gridTemplateColumns = "repeat(2, 1fr)";
    }
}