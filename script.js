document.getElementById("file").addEventListener("change", async (e) => {
    /**@type {FileList} */
    const files = e.target.files;

    const preview = document.getElementById("preview");
    const attuali = preview.querySelectorAll(".previewImage").length;
    const disponibili = 10 - attuali;

    if (disponibili === 0) {
        document.getElementById("label").style.display = "none";
        return;
    }

    if (files.length > disponibili) {
        alert(`Puoi caricare ancora solo ${disponibili} foto!`);
        return;
    }

    for (const file of files) {
        await showPreviewImage(file);
    }
})

async function showPreviewImage(/**@type {File}*/file) {
    const placeholder = document.createElement("div");
    placeholder.classList.add("previewPlaceholder");
    placeholder.textContent = "Caricamento";
    document.getElementById("preview").appendChild(placeholder);
    document.getElementById("preview").style.display = "grid";
    document.getElementById("formButton").style.display = "flex";
    aggiornaGriglia();

    let url;

    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.5 });
        url = URL.createObjectURL(blob);
    } else {
        url = URL.createObjectURL(file);
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("previewWrapper");

    const img = document.createElement("img");
    img.src = url;
    img.classList.add("previewImage");

    const x = document.createElement("button");
    x.classList.add("removeImage");
    x.textContent = "×";

    x.addEventListener("click", () => {
        wrapper.remove();
        aggiornaGriglia();
    });

    img.addEventListener("click", () => {
        lightboxImage.src = img.src;
        lightbox.classList.add("attivo");
    });

    wrapper.appendChild(img);
    wrapper.appendChild(x);
    placeholder.replaceWith(wrapper);
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
    const immagini = preview.querySelectorAll(".previewWrapper").length;

    if (immagini === 1) preview.style.gridTemplateColumns = "1fr";
    else preview.style.gridTemplateColumns = "repeat(2, 1fr)";


    if (immagini === 10) document.getElementById("label").style.display = "none";
    else document.getElementById("label").style.display = "block";

}

document.getElementById("reset").onclick = () => {
    document.getElementById("preview").innerHTML = "";
    document.getElementById("formButton").style.display = "none";
    document.getElementById("label").style.display = "block";
}

document.getElementById("submit").onclick = async (e) => {
    e.preventDefault();
    const immagini = document.querySelectorAll(".previewImage");

    if (immagini.length === 0) return;

    const formData = new FormData();

    for (let i = 0; i < immagini.length; i++) {
        const blob = await fetch(immagini[i].src).then(r => r.blob());
        formData.append("foto[]", blob, `foto_${i}.jpg`);
    }

    const response = await fetch("upload.php", {
        method: "POST",
        body: formData
    });

    const result = await response.text();
    location.reload();
    console.log(result);
}

async function caricaFoto() {
    const response = await fetch("photos.php");
    const immagini = await response.json();

    const feed = document.getElementById("feed");

    immagini.forEach(src => {
        const post = document.createElement("div");
        post.classList.add("post");

        const name = document.createElement("div");
        name.innerText = "Nome";
        name.classList.add("name");

        const img = document.createElement("img");
        img.src = src;
        img.classList.add("photoImage");
        img.addEventListener("click", () => {
            lightboxImage.src = img.src;
            lightbox.classList.add("attivo");
        });

        const actions = document.createElement("div");
        actions.classList.add("postActions");
        actions.innerHTML = `
            <label class="btnCuore">❤️<span class="contatore">0</span></label>
            <label class="btnReazione">😊</label>
        `;

        post.appendChild(name);
        post.appendChild(img);
        post.appendChild(actions);
        feed.appendChild(post); 
        

        document.querySelectorAll(".btnCuore").forEach((e) => {
            e.addEventListener("click", () => {
                const cont = post.querySelector(".btnCuore .contatore");
                cont.textContent = parseInt(cont.textContent) + 1;
            });
        });
    });
}

caricaFoto();