/**
 * Script principale - Compleanno Amore
 * Gestione utenti, upload foto, sistema like Liquid OS
 */

// ============= GESTIONE UTENTI =============

let currentUser = null;
let currentUserId = null;

/**
 * Inizializza il sistema utenti al caricamento della pagina
 */
async function initUser() {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    if (storedUserId && storedUsername) {
        // Utente già registrato
        currentUserId = parseInt(storedUserId);
        currentUser = storedUsername;
        updateUserDisplay();
    } else {
        // Richiedi username
        promptForUsername();
    }
}

/**
 * Mostra prompt nativo per richiedere username
 */
function promptForUsername() {
    let username = null;

    // Loop finché non ottieni un username valido
    while (!username || username.trim().length < 2) {
        username = prompt('👋 Benvenuto! Qual è il tuo nome?', '');

        if (username === null) {
            // Utente ha cliccato annulla
            username = `Guest_${Math.floor(Math.random() * 10000)}`;
            break;
        }

        if (username.trim().length < 2) {
            alert('⚠️ Il nome deve avere almeno 2 caratteri');
            continue;
        }

        break;
    }

    // Registra/recupera utente dal server
    registerUser(username.trim());
}

/**
 * Registra utente tramite API
 */
async function registerUser(username) {
    try {
        const response = await fetch('api-users.php?action=register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (data.successo) {
            currentUserId = data.id;
            currentUser = data.username;

            // Salva nel localStorage
            localStorage.setItem('userId', currentUserId);
            localStorage.setItem('username', currentUser);

            updateUserDisplay();
            caricaFoto();

            if (data.nuovo) {
                console.log(`✨ Benvenuto ${currentUser}!`);
            } else {
                console.log(`👋 Bentornato ${currentUser}!`);
            }
        } else {
            alert('❌ Errore registrazione: ' + (data.errore || 'Sconosciuto'));
        }
    } catch (error) {
        console.error('Errore registrazione:', error);
        alert('❌ Errore connessione server');
    }
}

/**
 * Aggiorna display username in header
 */
function updateUserDisplay() {
    const userInfoEl = document.getElementById('currentUser');
    if (userInfoEl) {
        userInfoEl.textContent = `👤 ${currentUser}`;
    }
}

/**
 * Pulsante per cambiare utente
 */
document.addEventListener('DOMContentLoaded', () => {
    const changeUserBtn = document.getElementById('changeUserBtn');
    if (changeUserBtn) {
        changeUserBtn.addEventListener('click', () => {
            if (confirm('Sei sicuro di voler cambiare utente?')) {
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                currentUser = null;
                currentUserId = null;
                location.reload();
            }
        });
    }
});

// ============= GESTIONE UPLOAD =============

document.getElementById('file').addEventListener('change', async (e) => {
    if (!currentUserId) {
        alert('❌ Utente non autenticato');
        return;
    }

    const files = e.target.files;
    const preview = document.getElementById('preview');
    const attuali = preview.querySelectorAll('.previewWrapper').length;
    const disponibili = 10 - attuali;

    if (disponibili === 0) {
        alert('⚠️ Hai raggiunto il limite di 10 foto');
        document.getElementById('label').style.display = 'none';
        return;
    }

    if (files.length > disponibili) {
        alert(`⚠️ Puoi caricare ancora solo ${disponibili} foto!`);
        return;
    }

    for (const file of files) {
        await showPreviewImage(file);
    }
});

/**
 * Mostra anteprima immagine prima del caricamento
 */
async function showPreviewImage(file) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('previewPlaceholder');
    placeholder.textContent = '⏳ Caricamento...';
    document.getElementById('preview').appendChild(placeholder);
    document.getElementById('preview').style.display = 'grid';
    document.getElementById('formButton').style.display = 'flex';
    aggiornaGriglia();

    let url;

    try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
            const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 });
            url = URL.createObjectURL(blob);
        } else {
            url = URL.createObjectURL(file);
        }

        const wrapper = document.createElement('div');
        wrapper.classList.add('previewWrapper');

        const img = document.createElement('img');
        img.src = url;
        img.classList.add('previewImage');
        img.dataset.file = JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size
        });

        const btnRemove = document.createElement('button');
        btnRemove.classList.add('removeImage');
        btnRemove.textContent = '×';
        btnRemove.type = 'button';

        btnRemove.addEventListener('click', (e) => {
            e.preventDefault();
            wrapper.remove();
            aggiornaGriglia();
        });

        img.addEventListener('click', () => {
            showLightbox(img.src);
        });

        wrapper.appendChild(img);
        wrapper.appendChild(btnRemove);
        placeholder.replaceWith(wrapper);

    } catch (error) {
        console.error('Errore processamento file:', error);
        placeholder.textContent = '❌ Errore';
    }
}

/**
 * Aggiorna layout griglia anteprima
 */
function aggiornaGriglia() {
    const preview = document.getElementById('preview');
    const immagini = preview.querySelectorAll('.previewWrapper').length;

    if (immagini === 0) {
        preview.style.gridTemplateColumns = '';
        preview.style.display = 'none';
    } else if (immagini === 1) {
        preview.style.gridTemplateColumns = '1fr';
    } else {
        preview.style.gridTemplateColumns = 'repeat(2, 1fr)';
    }

    document.getElementById('label').style.display = immagini >= 10 ? 'none' : 'block';
}

/**
 * Reset form
 */
document.getElementById('reset').addEventListener('click', () => {
    document.getElementById('preview').innerHTML = '';
    document.getElementById('formButton').style.display = 'none';
    document.getElementById('label').style.display = 'block';
});

/**
 * Invio form caricamento
 */
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUserId) {
        alert('❌ Utente non autenticato');
        return;
    }

    const immagini = document.querySelectorAll('.previewImage');

    if (immagini.length === 0) {
        alert('⚠️ Seleziona almeno una foto');
        return;
    }

    document.getElementById('submit').disabled = true;
    document.getElementById('status').textContent = '⏳ Caricamento in corso...';

    try {
        const formData = new FormData();
        formData.append('utente_id', currentUserId);

        // Converte blob in file
        for (let i = 0; i < immagini.length; i++) {
            const blob = await fetch(immagini[i].src).then(r => r.blob());
            const fileData = JSON.parse(immagini[i].dataset.file);
            formData.append('foto[]', blob, fileData.name);
        }

        const response = await fetch('upload.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.successo) {
            document.getElementById('status').textContent = `✅ ${result.caricate} foto caricate con successo!`;
            document.getElementById('preview').innerHTML = '';
            document.getElementById('formButton').style.display = 'none';
            document.getElementById('label').style.display = 'block';

            // Ricarica feed
            setTimeout(() => {
                caricaFoto();
            }, 1000);
        } else {
            document.getElementById('status').textContent = `❌ Errore: ${result.errori.join(', ')}`;
        }

    } catch (error) {
        console.error('Errore upload:', error);
        document.getElementById('status').textContent = '❌ Errore durante il caricamento';
    } finally {
        document.getElementById('submit').disabled = false;
    }
});

// ============= LIGHTBOX =============

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');

/**
 * Mostra lightbox con immagine
 */
function showLightbox(src) {
    lightboxImage.src = src;
    lightbox.classList.add('attivo');
}

/**
 * Chiude lightbox
 */
function closeLightbox() {
    lightbox.classList.remove('attivo');
}

// Chiudi cliccando su X
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

// Chiudi cliccando fuori immagine
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

// Chiudi con tasto ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// ============= GESTIONE FEED E LIKE =============

/**
 * SVG cuore per il bottone like
 */
function getHeartSvg() {
    return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>`;
}

/**
 * Carica e visualizza foto dal database
 */
async function caricaFoto() {
    try {
        const response = await fetch('photos.php');
        const data = await response.json();

        if (!data.successo) {
            console.error('Errore caricamento foto:', data.errore);
            return;
        }

        const feed = document.getElementById('feed');
        feed.innerHTML = '';

        if (data.foto.length === 0) {
            feed.innerHTML = '<p class="empty-message">📸 Nessuna foto ancora. Sii il primo!</p>';
            return;
        }

        // Renderizza ogni foto
        for (const foto of data.foto) {
            const post = document.createElement('div');
            post.classList.add('post');
            post.dataset.fotoId = foto.id;

            // Header con username
            const header = document.createElement('div');
            header.classList.add('post-header');
            header.innerHTML = `
                <span class="post-username">👤 ${foto.username}</span>
                <span class="post-date">${formatDate(foto.data)}</span>
            `;

            // Media
            const media = document.createElement('div');
            media.classList.add('post-media');

            if (foto.tipo.includes('image')) {
                const img = document.createElement('img');
                img.src = foto.percorso;
                img.classList.add('photoImage');
                img.addEventListener('click', () => showLightbox(img.src));
                media.appendChild(img);
            } else if (foto.tipo.includes('video')) {
                const video = document.createElement('video');
                video.src = foto.percorso;
                video.controls = true;
                video.classList.add('photoVideo');
                media.appendChild(video);
            }

            // Azioni
            const actions = document.createElement('div');
            actions.classList.add('post-actions');
            actions.innerHTML = `
                <button class="btn-like" data-foto-id="${foto.id}" title="Mi piace">
                    <span class="like-icon">${getHeartSvg()}</span>
                    <span class="like-count">${foto.like}</span>
                </button>
            `;

            post.appendChild(header);
            post.appendChild(media);
            post.appendChild(actions);
            feed.appendChild(post);
        }

        // Aggancia event listener ai bottoni like
        attachLikeListeners();

    } catch (error) {
        console.error('Errore caricamento feed:', error);
        document.getElementById('feed').innerHTML = '<p class="error-message">❌ Errore caricamento feed</p>';
    }
}

/**
 * Aggancia listener ai bottoni like
 */
function attachLikeListeners() {
    document.querySelectorAll('.btn-like').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!currentUserId) {
                alert('❌ Devi essere autenticato per mettere like');
                return;
            }

            const fotoId = parseInt(btn.dataset.fotoId);

            try {
                const response = await fetch('api-likes.php?action=toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        foto_id: fotoId,
                        utente_id: currentUserId
                    })
                });

                const data = await response.json();

                if (data.successo) {
                    // Aggiorna UI
                    btn.classList.toggle('liked', data.liked);
                    btn.querySelector('.like-count').textContent = data.total_like;

                    // Trigger animazione
                    if (data.liked) {
                        btn.classList.add('animate');
                        setTimeout(() => btn.classList.remove('animate'), 600);
                    }
                } else {
                    console.error('Errore like:', data.errore);
                }
            } catch (error) {
                console.error('Errore toggle like:', error);
                alert('❌ Errore aggiornamento like');
            }
        });
    });
}

/**
 * Formatta data in formato leggibile
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const oggi = new Date();

    if (date.toDateString() === oggi.toDateString()) {
        return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// ============= INIZIALIZZAZIONE =============

document.addEventListener('DOMContentLoaded', () => {
    initUser();
});
