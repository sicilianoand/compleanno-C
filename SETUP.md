# 🎂 Compleanno Amore - Guida Implementazione

## 📋 Riepilogo Implementazione

Ho completato un sistema full-stack per la gestione di foto e like con le seguenti funzionalità:

### ✅ Componenti Implementati

#### 1. **Gestione Utenti (LocalStorage + Database)**
- ✅ Prompt nativo al primo accesso per inserire username
- ✅ Salvataggio username in LocalStorage e MySQL
- ✅ Auto-riconoscimento utente al revisit
- ✅ Pulsante "Cambia utente" nell'header

#### 2. **Sistema Like "Liquid OS"**
- ✅ Cuore SVG minimalista (contorno vuoto)
- ✅ Animazione elastica cubic-bezier al click
- ✅ Colore rosso pieno (#ff2d55) quando attivo
- ✅ Persistenza like nel database tramite Fetch API
- ✅ Contatore like in tempo reale

#### 3. **Upload Foto Sicuro (BUG FIXATO)**
- ✅ Validazione MIME type (JPEG, PNG, WEBP, MP4, MOV, WEBM)
- ✅ Generazione hash unico per nomi file (prevenzione directory traversal)
- ✅ Inserimento corretto nel database con ID utente
- ✅ Risposta JSON strutturata con errori dettagliati
- ✅ Gestione permessi cartella upload

---

## 🚀 Istruzioni Setup

### Prerequisiti
- XAMPP/LAMP con PHP 7.4+
- MySQL 5.7+
- Browser moderno

### Step 1: Creare Database

```bash
# Accedi a MySQL
mysql -u root -p

# Copia e incolla il contenuto di database.sql
source c:/xampp/htdocs/compleanno-amore/database.sql;

# Oppure manualmente:
# 1. Apri phpMyAdmin
# 2. Crea database "compleanno_amore"
# 3. Importa il file database.sql
```

### Step 2: Configurare Credenziali Database

Modifica `config.php` con le tue credenziali:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');        // Cambia se necessario
define('DB_PASS', '');            // Aggiungi password se presente
define('DB_NAME', 'compleanno_amore');
```

### Step 3: Creare Cartella Upload

```bash
# La cartella "uploads" viene creata automaticamente
# Ma puoi crearla manualmente se necessario
mkdir uploads
chmod 755 uploads
```

### Step 4: Verifica File

```
compleanno-amore/
├── index.html            ✅ (aggiornato)
├── script.js             ✅ (completamente riscritto)
├── style.css             ✅ (nuovi stili + animazioni)
├── config.php            ✅ (NUOVO - configurazione DB)
├── api-users.php         ✅ (NUOVO - gestione utenti)
├── api-likes.php         ✅ (NUOVO - sistema like)
├── upload.php            ✅ (FIXATO - upload sicuro)
├── photos.php            ✅ (aggiornato - lettura da DB)
├── database.sql          ✅ (NUOVO - schema database)
└── uploads/              (cartella creata automaticamente)
```

---

## 📱 Utilizzo

### Primo Accesso
1. Apri `index.html` nel browser
2. Comparirà un prompt nativo che chiede il nome utente
3. Inserisci il nome (min 2 caratteri)
4. Verrai riconosciuto nei prossimi accessi

### Caricamento Foto
1. Clicca su **"+"** per selezionare foto/video
2. Vedi anteprima in griglia
3. Clicca **"CARICA"** per salvare
4. Le foto vengono salvate nel database associate al tuo profilo

### Sistema Like
1. Ogni foto mostra un **cuore vuoto** (SVG)
2. Clicca il cuore per mettere like
3. L'animazione Liquid OS si attiva
4. Il cuore diventa **rosso pieno (#ff2d55)**
5. Il contatore si aggiorna in tempo reale
6. Lo stato persiste nel database

---

## 🔧 Dettagli Tecnici

### Validazione Upload
```php
// Tipi MIME consentiti
- image/jpeg      → .jpg
- image/png       → .png
- image/webp      → .webp
- video/mp4       → .mp4
- video/quicktime → .mov
- video/webm      → .webm

// Limite: 50 MB per file
// Nomi file: hash SHA256 (prevenzione collisioni)
```

### API Endpoints

#### Utenti
```
POST /api-users.php?action=register
Body: { "username": "Nome" }
Response: { "successo": true, "id": 1, "username": "Nome", "nuovo": true }

GET /api-users.php?action=get&id=1
Response: { "successo": true, "utente": {...} }
```

#### Like
```
POST /api-likes.php?action=toggle
Body: { "foto_id": 5, "utente_id": 1 }
Response: { "successo": true, "liked": true, "total_like": 3 }

GET /api-likes.php?action=count?foto_id=5&utente_id=1
Response: { "successo": true, "total_like": 3, "user_liked": true }
```

#### Foto
```
GET /photos.php
Response: { "successo": true, "foto": [
  { "id": 1, "percorso": "../uploads/...", "username": "Nome", "like": 5 }
] }

POST /upload.php
FormData: { "utente_id": 1, "foto[]": [File] }
Response: { "successo": true, "caricate": 2, "foto": [...] }
```

---

## 🎨 Personalizzazione

### Animazione Like
Modifica `style.css` - sezione `@keyframes liquidLike`:
```css
@keyframes liquidLike {
    0% { transform: scale(1); }
    50% { transform: scale(1.4); }      /* Aumenta per più elasticità */
    100% { transform: scale(1.3); }
}
```

### Colore Cuore
```css
/* Default */
.btn-like .like-icon { color: currentColor; }

/* Liked */
.btn-like.liked .like-icon { color: #ff2d55; }

/* Cambia #ff2d55 con il colore desiderato */
```

### Limite Upload
Modifica `config.php`:
```php
define('UPLOAD_MAX_SIZE', 50 * 1024 * 1024); // In byte
```

---

## 🐛 Troubleshooting

### Errore: "Errore connessione database"
- ✅ Verifica credenziali in `config.php`
- ✅ Assicurati che MySQL sia in esecuzione
- ✅ Verifica che il database `compleanno_amore` esista

### Errore: "Cartella upload non scrivibile"
```bash
# Linux/Mac
chmod 755 uploads

# Windows: clicca destro > Proprietà > Sicurezza > Modifica
```

### Le foto non vengono caricate
- ✅ Controlla che il tipo di file sia consentito
- ✅ Verifica la dimensione (max 50 MB)
- ✅ Controlla la console del browser (F12) per errori

### Like non persistono
- ✅ Verifica che l'utente sia correttamente registrato
- ✅ Controlla che il database sia connesso
- ✅ Controlla la console del browser (F12)

---

## 📝 Note Importanti

1. **LocalStorage**: I dati utente sono salvati localmente nel browser. Cancellare la cache li elimina.
2. **HTTPS**: Per la produzione, usa HTTPS per proteggere i dati.
3. **Backup Database**: Esegui backup regolari del database.
4. **Permessi File**: Assicura che la cartella `uploads` sia scrivibile.
5. **Max Upload**: Aumenta `max_upload_size` in `php.ini` se necessario.

---

## 🔒 Sicurezza Implementata

✅ **SQL Injection**: Query preparate con PDO  
✅ **File Upload**: Validazione MIME type + hash unico  
✅ **Directory Traversal**: Path sanitizzato con hash  
✅ **XSS**: Escape JSON e output  
✅ **CSRF**: Tollerante (può aggiungere token se necessario)

---

## 📞 Supporto

Per problemi:
1. Controlla la console del browser (F12)
2. Verifica i log di errore PHP
3. Controlla i permessi di cartella
4. Verifica la connessione database

---

**Creato**: 16 Maggio 2026  
**Versione**: 1.0  
**Autore**: Full-Stack Developer AI
