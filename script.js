/**
 * Script principale - Compleanno Amore
 * Gestione utenti, upload foto, sistema like Liquid OS
 */

// ============= GESTIONE UTENTI =============

let currentUser = null;
let currentUserId = null;

/**
 * Mostra modale di conferma personalizzata — restituisce una Promise<boolean>
 */
function showConfirm(message, { confirmLabel = 'Conferma', distruttivo = false } = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const textEl = document.getElementById('confirmText');
        const btnOk = document.getElementById('confirmBtnOk');
        const btnCancel = document.getElementById('confirmBtnCancel');
        const pageContent = document.getElementById('pageContent');

        textEl.textContent = message;
        btnOk.textContent = confirmLabel;
        btnOk.classList.toggle('distruttivo', distruttivo);

        modal.classList.add('attivo');
        pageContent.classList.add('blur');

        const close = (result) => {
            modal.classList.remove('attivo');
            pageContent.classList.remove('blur');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKey);
            resolve(result);
        };

        const handleOk = () => close(true);
        const handleCancel = () => close(false);
        const handleKey = (e) => { if (e.key === 'Escape') close(false); };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKey);
    });
}

/**
 * Mostra notifica modale al centro dello schermo
 */
function showNotification(message) {
    const modal = document.getElementById('notificationModal');
    const textEl = document.getElementById('notificationText');
    const btnEl = document.getElementById('notificationBtn');
    const pageContent = document.getElementById('pageContent');

    textEl.textContent = message;
    modal.classList.add('attivo');
    pageContent.classList.add('blur');

    const closeNotification = () => {
        modal.classList.remove('attivo');
        pageContent.classList.remove('blur');
        btnEl.removeEventListener('click', closeNotification);
        document.removeEventListener('keydown', handleEscape);
    };

    const handleEscape = (e) => {
        if (e.key === 'Escape') closeNotification();
    };

    btnEl.addEventListener('click', closeNotification);
    document.addEventListener('keydown', handleEscape);
}

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
 * Mostra modal per richiedere username
 */
function promptForUsername() {
    const modal = document.getElementById('usernameModal');
    const input = document.getElementById('usernameInput');
    const btnConfirm = document.getElementById('usernameBtnConfirm');
    const btnSkip = document.getElementById('usernameBtnSkip');
    const pageContent = document.getElementById('pageContent');

    modal.classList.add('attivo');
    pageContent.classList.add('blur');
    input.focus();

    const handleConfirm = () => {
        const username = input.value.trim();

        if (username.length < 2) {
            showNotification('⚠️ Il nome deve avere almeno 2 caratteri');
            input.focus();
            return;
        }

        closeModal();
        registerUser(username);
    };

    const handleSkip = () => {
        closeModal();
        const guestName = `Guest_${Math.floor(Math.random() * 10000)}`;
        registerUser(guestName);
    };

    const closeModal = () => {
        modal.classList.remove('attivo');
        pageContent.classList.remove('blur');
        btnConfirm.removeEventListener('click', handleConfirm);
        btnSkip.removeEventListener('click', handleSkip);
        input.removeEventListener('keydown', handleEnter);
    };

    const handleEnter = (e) => {
        if (e.key === 'Enter') handleConfirm();
    };

    btnConfirm.addEventListener('click', handleConfirm);
    btnSkip.addEventListener('click', handleSkip);
    input.addEventListener('keydown', handleEnter);
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
            showNotification('❌ Errore registrazione: ' + (data.errore || 'Sconosciuto'));
        }
    } catch (error) {
        console.error('Errore registrazione:', error);
        showNotification('❌ Errore connessione server');
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
        showNotification('❌ Utente non autenticato');
        return;
    }

    const files = e.target.files;
    const preview = document.getElementById('preview');
    const attuali = preview.querySelectorAll('.previewWrapper').length;
    const disponibili = 10 - attuali;

    if (disponibili === 0) {
        showNotification('⚠️ Hai raggiunto il limite di 10 foto');
        document.getElementById('label').style.display = 'none';
        return;
    }

    if (files.length > disponibili) {
        showNotification(`⚠️ Puoi caricare ancora solo ${disponibili} foto!`);
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
    // NON chiamare aggiornaGriglia qui — il wrapper non esiste ancora

    let url;
    let convertedBlob = null;

    try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
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
        placeholder.replaceWith(wrapper); // prima sostituisce...
        aggiornaGriglia();                // ...poi aggiorna la griglia

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
        showNotification('❌ Utente non autenticato');
        return;
    }

    const immagini = document.querySelectorAll('.previewImage');

    if (immagini.length === 0) {
        showNotification('⚠️ Seleziona almeno una foto');
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
                    if (xhr.status < 200 || xhr.status >= 300) {
                        reject(new Error(`Errore server (${xhr.status}): ${xhr.responseText}`));
                        return;
                    }
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('Risposta non valida dal server: ' + e.message));
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
        statusEl.textContent = `❌ Errore: ${error.message || 'durante il caricamento'}`;
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
function creaPostElement(foto, isPrima = false) {
    const post = document.createElement('div');
    post.classList.add('post');
    post.dataset.fotoId = foto.id;

    if (isPrima) {
        post.classList.add('prima-foto');
        const badge = document.createElement('div');
        badge.classList.add('prima-foto-badge');
        badge.innerHTML = '<span class="badge-trophy">🏆</span><span>Prima foto del party!</span>';
        post.appendChild(badge);
    }

    const header = document.createElement('div');
    header.classList.add('post-header');
    const isOwnPhoto = foto.username === currentUser;
    header.innerHTML = `
        <span class="post-username">👤 ${escapeHtml(foto.username)}</span>
        <span class="post-date">${formatDate(foto.data)}</span>
        ${isOwnPhoto ? '<button class="btn-delete-photo" title="Elimina questa foto">🗑️</button>' : ''}
    `;

    if (isOwnPhoto) {
        const deleteBtn = header.querySelector('.btn-delete-photo');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!await showConfirm('Sei sicuro di voler eliminare questa foto?', { confirmLabel: 'Elimina', distruttivo: true })) {
                return;
            }

            deleteBtn.disabled = true;
            deleteBtn.textContent = '⏳';

            try {
                const response = await fetch('PHP/api-photos.php?action=delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        foto_id: foto.id,
                        utente_id: currentUserId
                    })
                });

                const data = await response.json();

                if (data.successo) {
                    post.style.opacity = '0.5';
                    setTimeout(() => {
                        post.remove();
                    }, 300);
                } else {
                    showNotification('❌ Errore eliminazione: ' + (data.errore || 'Sconosciuto'));
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '🗑️';
                }
            } catch (error) {
                console.error('Errore eliminazione foto:', error);
                showNotification('❌ Errore: ' + error.message);
                deleteBtn.disabled = false;
                deleteBtn.textContent = '🗑️';
            }
        });
    }

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
            feed.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📸</span>
                    <h3 class="empty-title">Nessuna foto ancora</h3>
                    <p class="empty-subtitle">Sii il primo a condividere<br>un momento speciale!</p>
                </div>`;
            avviaSSE();
            return;
        }

        const primaFotoId = Math.min(...data.foto.map(f => f.id));
        for (const foto of data.foto) {
            feed.appendChild(creaPostElement(foto, foto.id === primaFotoId));
        }
        maxFotoId = Math.max(...data.foto.map(f => f.id));

        attachLikeListeners();
        avviaSSE();

    } catch (error) {
        console.error('Errore caricamento feed:', error);
        document.getElementById('feed').innerHTML = '<p class="error-message">❌ Errore caricamento feed</p>';
    }
}

// ============= AGGIORNAMENTI REAL-TIME (SSE) =============

let maxFotoId = 0;
let lastDeleteId = 0;
let sseConnessione = null;
let pollingInterval = null; // usato solo come fallback

/**
 * Inserisce nel feed le foto arrivate via SSE (o polling fallback).
 * nuoveFoto è già ordinata ASC (più vecchia prima) — il reverse le mette
 * nella posizione giusta: la più recente in cima.
 */
function inserisciFotoNelFeed(nuoveFoto) {
    const feed = document.getElementById('feed');
    const idNelFeed = new Set(
        [...feed.querySelectorAll('.post[data-foto-id]')].map(el => parseInt(el.dataset.fotoId))
    );

    const davveroNuove = nuoveFoto.filter(f => !idNelFeed.has(f.id));
    if (davveroNuove.length === 0) return;

    feed.querySelector('.empty-state')?.remove();

    const tuttiGliId = [...idNelFeed, ...davveroNuove.map(f => f.id)];
    const primaFotoId = Math.min(...tuttiGliId);
    const haBadge = !!feed.querySelector('.prima-foto-badge');

    davveroNuove.forEach(foto => {
        const isPrima = !haBadge && foto.id === primaFotoId;
        const post = creaPostElement(foto, isPrima);
        post.classList.add('nuova');
        feed.insertBefore(post, feed.firstChild);
        setTimeout(() => post.classList.remove('nuova'), 600);
        maxFotoId = Math.max(maxFotoId, foto.id);
    });

    if (!haBadge) {
        const primaPost = feed.querySelector(`[data-foto-id="${primaFotoId}"]`);
        if (primaPost && !primaPost.querySelector('.prima-foto-badge')) {
            primaPost.classList.add('prima-foto');
            const badge = document.createElement('div');
            badge.classList.add('prima-foto-badge');
            badge.innerHTML = '<span class="badge-trophy">🏆</span><span>Prima foto del party!</span>';
            primaPost.insertBefore(badge, primaPost.firstChild);
        }
    }

    attachLikeListeners();
}

/**
 * Apre una connessione SSE verso il server.
 * Il server spinge nuove foto in push ogni ~2 s appena arrivano nel DB.
 * In caso di errore permanente cade in fallback su polling ogni 5 s.
 */
function avviaSSE() {
    if (!window.EventSource) { avviaPolling(); return; }
    if (sseConnessione) sseConnessione.close();

    const params = new URLSearchParams({ lastId: maxFotoId, lastDeleteId });
    if (currentUserId) params.set('utente_id', currentUserId);

    sseConnessione = new EventSource(`PHP/events.php?${params}`);

    sseConnessione.addEventListener('nuove-foto', (e) => {
        const { foto } = JSON.parse(e.data);
        if (foto?.length) inserisciFotoNelFeed(foto);
    });

    sseConnessione.addEventListener('foto-eliminata', (e) => {
        const { ids } = JSON.parse(e.data);
        ids?.forEach(eliminaPostDalFeed);
    });

    let errori = 0;
    sseConnessione.onerror = () => {
        errori++;
        if (errori >= 3) {
            sseConnessione.close();
            sseConnessione = null;
            avviaPolling();
        }
    };

    sseConnessione.addEventListener('connected', () => { errori = 0; });
}

/**
 * Rimuove un post dal feed con animazione, dato il suo foto_id.
 */
function eliminaPostDalFeed(fotoId) {
    const post = document.querySelector(`.post[data-foto-id="${fotoId}"]`);
    if (!post) return;

    post.classList.add('eliminata');
    post.addEventListener('animationend', () => {
        post.remove();
        // Se il feed è rimasto vuoto, mostra l'empty state
        const feed = document.getElementById('feed');
        if (!feed.querySelector('.post')) {
            feed.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📸</span>
                    <h3 class="empty-title">Nessuna foto ancora</h3>
                    <p class="empty-subtitle">Sii il primo a condividere<br>un momento speciale!</p>
                </div>`;
        }
    }, { once: true });
}

/** Fallback polling usato se SSE non è disponibile o fallisce */
function avviaPolling() {
    if (pollingInterval) return;
    pollingInterval = setInterval(async () => {
        try {
            const url = currentUserId
                ? `PHP/photos.php?utente_id=${currentUserId}`
                : 'PHP/photos.php';
            const data = await fetch(url).then(r => r.json());
            if (data.successo && data.foto.length) {
                const nuove = data.foto.filter(f => f.id > maxFotoId);
                if (nuove.length) inserisciFotoNelFeed([...nuove].reverse());
            }
        } catch (e) { console.error('Polling error:', e); }
    }, 5000);
}

// Chiudi SSE quando la tab va in background, riapri al ritorno
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        sseConnessione?.close();
        sseConnessione = null;
        clearInterval(pollingInterval);
        pollingInterval = null;
    } else if (currentUserId) {
        avviaSSE();
    }
});

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
                showNotification('❌ Devi essere autenticato per mettere like');
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

    headerDot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (headerBox.classList.contains('aperto')) {
            chiudiPopup();
        } else {
            apriPopup();
        }
    });

    // Chiudi cliccando fuori dal popup (su qualsiasi elemento della pagina)
    document.addEventListener('mousedown', (e) => {
        if (
            headerBox.classList.contains('aperto') &&
            !headerBox.contains(e.target) &&
            !headerDot.contains(e.target)
        ) {
            chiudiPopup();
        }
    });

    // Stesso comportamento su touch (mobile)
    document.addEventListener('touchstart', (e) => {
        if (
            headerBox.classList.contains('aperto') &&
            !headerBox.contains(e.target) &&
            !headerDot.contains(e.target)
        ) {
            chiudiPopup();
        }
    }, { passive: true });

    // Chiudi allo scroll
    window.addEventListener('scroll', () => {
        if (headerBox.classList.contains('aperto')) {
            chiudiPopup();
        }
    }, { passive: true });

    // Cambia utente
    if (changeUserBtn) {
        changeUserBtn.addEventListener('click', async () => {
            chiudiPopup();
            await new Promise(r => setTimeout(r, 200));
            if (await showConfirm('Sei sicuro di voler cambiare utente?', { confirmLabel: 'Cambia' })) {
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                currentUser = null;
                currentUserId = null;
                location.reload();
            }
        });
    }

    initUser();
});