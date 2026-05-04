document.getElementById("file").addEventListener("change", (e) => {
    /**@type {File} */
    const files = e.target.files;
    for (const file of files) {
        showPreviewImage(file)
    }
})

async function showPreviewImage(/**@type {File}*/file) {
    let url;

    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        const blob = await heic2any({ blob: file, toType: "image/jpeg" });
        url = URL.createObjectURL(blob);
    } else {
        url = URL.createObjectURL(file);
    }

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

    if (immagini >= 10)
        document.getElementById("label").style.display = "none";

}

document.getElementById("reset").onclick = () => {
    document.getElementById("preview").innerHTML = "";
    document.getElementById("formButton").style.display = "none";
    document.getElementById("label").style.display = "block";
}