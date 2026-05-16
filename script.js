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
        caricaFoto(); // FIX Bug 3: carica il feed anche per utenti già registrati
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

    while (!username || username.trim().length < 2) {
        username = prompt('👋 Benvenuto! Qual è il tuo nome?', '');

        if (username === null) {
            username = `Guest_${Math.floor(Math.random() * 10000)}`;
            break;
        }

        if (username.trim().length < 2) {
            alert('⚠️ Il nome deve avere almeno 2 caratteri');
            continue;
        }

        break;
    }

    registerUser(username.trim());
}

/**
 * Registra utente tramite API
 */
async function registerUser(username) {
    try {
        const response = await fetch('PHP/api-users.php?action=register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (data.successo) {
            currentUserId = data.id;
            currentUser = data.username;

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
 * Aggiorna display username e mostra il quadratino
 */
function updateUserDisplay() {
    const userInfoEl = document.getElementById('currentUser');
    const headerDot = document.getElementById('headerDot');

    if (userInfoEl) {
        userInfoEl.textContent = `👤 ${currentUser}`;
    }
    if (headerDot) {
        headerDot.style.display = 'flex';
    }
}

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
    let convertedBlob = null;

    try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            // FIX Bug 5: salva il blob convertito per usarlo nell'upload con estensione corretta
            convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
            url = URL.createObjectURL(convertedBlob);
        } else {
            url = URL.createObjectURL(file);
        }

        const wrapper = document.createElement('div');
        wrapper.classList.add('previewWrapper');

        const img = document.createElement('img');
        img.src = url;
        img.classList.add('previewImage');

        // FIX Bug 5: se era HEIC, salva nome con .jpg e type corretto
        const nomeFile = convertedBlob
            ? file.name.replace(/\.(heic|heif)$/i, '.jpg')
            : file.name;
        const tipoFile = convertedBlob ? 'image/jpeg' : file.type;

        img.dataset.file = JSON.stringify({
            name: nomeFile,
            type: tipoFile,
            size: convertedBlob ? convertedBlob.size : file.size,
            isConverted: !!convertedBlob
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
        document.getElementById('formButton').style.display = 'none';
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
    document.getElementById('preview').style.display = 'none';
    document.getElementById('formButton').style.display = 'none';
    document.getElementById('label').style.display = 'block';
    document.getElementById('status').textContent = '';
});

/**
 * Invio form caricamento
 * FIX: progress bar mostrata durante l'upload
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

    const submitBtn = document.getElementById('submit');
    const statusEl = document.getElementById('status');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    submitBtn.disabled = true;
    statusEl.textContent = '⏳ Preparazione file...';

    // FIX Bug 7: mostra la progress bar
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        const formData = new FormData();
        formData.append('utente_id', currentUserId);

        // Salva i blob URL delle preview PRIMA di svuotare il DOM
        const previewSrcs = [];
        for (let i = 0; i < immagini.length; i++) {
            previewSrcs.push(immagini[i].src);
            const blob = await fetch(immagini[i].src).then(r => r.blob());
            const fileData = JSON.parse(immagini[i].dataset.file);
            formData.append('foto[]', blob, fileData.name);

            const pct = Math.round(((i + 1) / immagini.length) * 50);
            progressBar.style.width = pct + '%';
        }

        statusEl.textContent = '⏳ Caricamento in corso...';

        // Upload con XMLHttpRequest per progress reale
        const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'PHP/upload.php');

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const pct = 50 + Math.round((e.loaded / e.total) * 50);
                    progressBar.style.width = pct + '%';
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new Error('Risposta non valida dal server'));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Errore di rete')));
            xhr.send(formData);
        });

        progressBar.style.width = '100%';

        if (result.successo) {
            statusEl.textContent = `✅ ${result.caricate} foto caricate con successo!`;
            document.getElementById('preview').innerHTML = '';
            document.getElementById('preview').style.display = 'none';
            document.getElementById('formButton').style.display = 'none';
            document.getElementById('label').style.display = 'block';

            // Inserisce subito le nuove foto in cima al feed senza aspettare una seconda fetch
            const feed = document.getElementById('feed');
            const emptyMsg = feed.querySelector('.empty-message');
            if (emptyMsg) emptyMsg.remove();

            const foteCopy = [...result.foto].reverse();
            foteCopy.forEach((foto, idx) => {
                // Usa il blob URL della preview come src temporaneo — visibile subito
                const srcTemporaneo = previewSrcs[result.foto.length - 1 - idx] || foto.percorso;
                const post = creaPostElement({
                    id: foto.id,
                    percorso: srcTemporaneo,
                    tipo: foto.tipo,
                    username: currentUser,
                    data: new Date().toISOString(),
                    like: 0,
                    user_liked: false
                });
                // Aggiorna il src con quello reale del server in background
                const imgEl = post.querySelector('.photoImage');
                if (imgEl) {
                    const realImg = new Image();
                    realImg.onload = () => { imgEl.src = foto.percorso; };
                    realImg.src = foto.percorso;
                }
                feed.insertBefore(post, feed.firstChild);
            });
            attachLikeListeners();

            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
                statusEl.textContent = '';
            }, 1200);
        } else {
            statusEl.textContent = `❌ Errore: ${(result.errori || []).join(', ')}`;
            progressContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Errore upload:', error);
        statusEl.textContent = '❌ Errore durante il caricamento';
        progressContainer.style.display = 'none';
    } finally {
        submitBtn.disabled = false;
    }
});

// ============= LIGHTBOX =============

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');

function showLightbox(src) {
    lightboxImage.src = src;
    lightbox.classList.add('attivo');
}

function closeLightbox() {
    lightbox.classList.remove('attivo');
    lightboxImage.src = '';
}

// FIX Bug 2: il pulsante ora esiste nell'HTML
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// ============= GESTIONE FEED E LIKE =============

function getHeartSvg() {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>`;
}

/**
 * Crea il DOM element di un post dato un oggetto foto
 */
function creaPostElement(foto) {
    const post = document.createElement('div');
    post.classList.add('post');
    post.dataset.fotoId = foto.id;

    const header = document.createElement('div');
    header.classList.add('post-header');
    header.innerHTML = `
        <span class="post-username">👤 ${escapeHtml(foto.username)}</span>
        <span class="post-date">${formatDate(foto.data)}</span>
    `;

    const media = document.createElement('div');
    media.classList.add('post-media');

    if (foto.tipo.includes('image')) {
        const img = document.createElement('img');
        img.src = foto.percorso;
        img.classList.add('photoImage');
        img.loading = 'lazy';
        img.alt = `Foto di ${foto.username}`;
        img.addEventListener('click', () => showLightbox(img.src));
        media.appendChild(img);
    } else if (foto.tipo.includes('video')) {
        const video = document.createElement('video');
        video.src = foto.percorso;
        video.controls = true;
        video.classList.add('photoVideo');
        media.appendChild(video);
    }

    const actions = document.createElement('div');
    actions.classList.add('post-actions');

    const likeBtn = document.createElement('button');
    likeBtn.classList.add('btn-like');
    if (foto.user_liked) likeBtn.classList.add('liked');
    likeBtn.dataset.fotoId = foto.id;
    likeBtn.title = 'Mi piace';
    likeBtn.innerHTML = `
        <span class="like-icon">${getHeartSvg()}</span>
        <span class="like-count">${foto.like}</span>
    `;
    actions.appendChild(likeBtn);

    post.appendChild(header);
    post.appendChild(media);
    post.appendChild(actions);
    return post;
}

/**
 * Carica e visualizza foto dal database
 */
async function caricaFoto() {
    try {
        const url = currentUserId
            ? `PHP/photos.php?utente_id=${currentUserId}`
            : 'PHP/photos.php';

        const response = await fetch(url);
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

        for (const foto of data.foto) {
            feed.appendChild(creaPostElement(foto));
        }

        attachLikeListeners();

    } catch (error) {
        console.error('Errore caricamento feed:', error);
        document.getElementById('feed').innerHTML = '<p class="error-message">❌ Errore caricamento feed</p>';
    }
}

/**
 * Escape HTML per prevenire XSS
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

            // Feedback visivo immediato (ottimistico)
            const wasLiked = btn.classList.contains('liked');
            const countEl = btn.querySelector('.like-count');
            const currentCount = parseInt(countEl.textContent) || 0;

            btn.classList.toggle('liked', !wasLiked);
            countEl.textContent = wasLiked ? currentCount - 1 : currentCount + 1;

            if (!wasLiked) {
                btn.classList.add('animate');
                setTimeout(() => btn.classList.remove('animate'), 600);
            }

            try {
                const response = await fetch('PHP/api-likes.php?action=toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        foto_id: fotoId,
                        utente_id: currentUserId
                    })
                });

                const data = await response.json();

                if (data.successo) {
                    // Allinea con il valore reale del server
                    btn.classList.toggle('liked', data.liked);
                    countEl.textContent = data.total_like;
                } else {
                    // Rollback in caso di errore
                    btn.classList.toggle('liked', wasLiked);
                    countEl.textContent = currentCount;
                    console.error('Errore like:', data.errore);
                }
            } catch (error) {
                // Rollback in caso di errore di rete
                btn.classList.toggle('liked', wasLiked);
                countEl.textContent = currentCount;
                console.error('Errore toggle like:', error);
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
    const headerDot = document.getElementById('headerDot');
    const headerBox = document.getElementById('headerBox');
    const headerOverlay = document.getElementById('headerOverlay');
    const changeUserBtn = document.getElementById('changeUserBtn');

    function apriPopup() {
        headerBox.classList.add('aperto');
        headerOverlay.classList.add('aperto');
    }

    function chiudiPopup() {
        headerBox.classList.remove('aperto');
        headerOverlay.classList.remove('aperto');
    }

    headerDot.addEventListener('click', () => {
        if (headerBox.classList.contains('aperto')) {
            chiudiPopup();
        } else {
            apriPopup();
        }
    });

    // Chiudi toccando l'overlay (si restringe nell'angolo)
    headerOverlay.addEventListener('click', chiudiPopup);

    // Chiudi allo scroll — si restringe con l'animazione spring inversa
    window.addEventListener('scroll', () => {
        if (headerBox.classList.contains('aperto')) {
            chiudiPopup();
        }
    }, { passive: true });

    // Cambia utente
    if (changeUserBtn) {
        changeUserBtn.addEventListener('click', () => {
            chiudiPopup();
            setTimeout(() => {
                if (confirm('Sei sicuro di voler cambiare utente?')) {
                    localStorage.removeItem('userId');
                    localStorage.removeItem('username');
                    currentUser = null;
                    currentUserId = null;
                    location.reload();
                }
            }, 200);
        });
    }

    initUser();
});