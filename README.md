# 🎂 Compleanno Celeste

Un'app web per condividere foto e video durante una festa di compleanno, con feed in tempo reale, like animati e interfaccia stile iOS.

![PHP](https://img.shields.io/badge/PHP-8.0+-777BB4?style=flat&logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat&logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)

---

## Screenshot

> Feed con glassmorphism, badge prima foto e aggiornamenti in tempo reale via SSE.

---

## Funzionalità

- **Feed real-time** — nuove foto e cancellazioni appaiono istantaneamente su tutti i dispositivi connessi, senza ricaricare la pagina (Server-Sent Events)
- **Upload multiplo** — fino a 10 file per volta con anteprima in griglia; supporto nativo per HEIC/HEIF (iPhone)
- **Like real-time** — i contatori si aggiornano in diretta su tutti i client via SSE; animazione elastica stile Liquid OS, persistita nel database
- **Reazioni emoji** — 12 emoji di festa selezionabili dal picker; un'emoji per utente per foto (cambio o rimozione con un tap); contatori in tempo reale via SSE
- **Gestione utenti** — registrazione al primo accesso, riconoscimento automatico via LocalStorage, verifica sessione ad ogni operazione
- **Eliminazione foto** — solo le proprie, con propagazione real-time a tutti i client
- **Badge prima foto** — la foto caricata per prima riceve un banner 🏆 animato
- **UI glassmorphism** — popup login, confirm dialog e notifiche con effetto vetro/acqua e blur iOS

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES2022) |
| Backend | PHP 8.0+ |
| Database | MySQL 5.7+ / MariaDB |
| Real-time | Server-Sent Events (SSE) |
| Server | Apache (XAMPP) |

Nessuna dipendenza npm. L'unica libreria esterna è [heic2any](https://github.com/alexcorvi/heic2any) (CDN) per la conversione di foto iPhone.

---

## Struttura del progetto

```
compleanno-amore/
├── index.html           # UI principale
├── style.css            # Stili + animazioni glassmorphism
├── script.js            # Logica client (upload, SSE, like, modali)
├── database.sql         # Schema SQL completo
├── font/
│   └── adelia.ttf       # Font decorativo per il titolo
├── img/
│   └── foto_qrcode.jpg  # QR code per accesso rapido da mobile
├── PHP/
│   ├── config.php       # Connessione DB e costanti
│   ├── api-users.php    # Registrazione e lookup utenti
│   ├── api-likes.php    # Toggle like
│   ├── api-photos.php   # Eliminazione foto
│   ├── upload.php       # Upload multi-file con validazione
│   ├── photos.php       # Feed foto con stato like
│   └── events.php       # Endpoint SSE (nuove foto + eliminazioni)
└── uploads/             # Generata automaticamente
```

---

## Installazione

### Prerequisiti

- [XAMPP](https://www.apachefriends.org/) (o qualsiasi stack Apache + PHP 8.0+ + MySQL)
- Browser moderno con supporto `EventSource` (Chrome, Firefox, Safari, Edge)

### 1. Clona il repository

```bash
git clone https://github.com/tuo-username/compleanno-amore.git
# Oppure scarica lo ZIP e decomprimi in:
# C:\xampp\htdocs\compleanno-amore\
```

### 2. Crea il database

Apri **phpMyAdmin** (`http://localhost/phpmyadmin`) e importa `database.sql`, oppure da terminale:

```bash
mysql -u root -p < database.sql
```

La tabella `foto_eliminate` (necessaria per il real-time delle cancellazioni) viene creata automaticamente al primo utilizzo — non serve aggiungerla manualmente.

### 3. Configura le credenziali

Apri [PHP/config.php](PHP/config.php) e verifica:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');            // Inserisci la tua password se presente
define('DB_NAME', 'compleanno_amore');
```

### 4. Avvia XAMPP e apri l'app

Avvia **Apache** e **MySQL** dal pannello XAMPP, poi vai su:

```
http://localhost/compleanno-amore/
```

---

## Come funziona il real-time

L'app usa **Server-Sent Events** invece del polling tradizionale.

```
Browser A                    PHP events.php              Browser B
    │                              │                          │
    ├──── GET /events.php ────────►│                          │
    │     (connessione aperta)     │◄─── GET /events.php ────┤
    │                              │     (connessione aperta) │
    │                              │                          │
    │  [A carica una foto]         │                          │
    │                              │  SELECT id > lastId      │
    │                              │  → nuova foto trovata    │
    │◄── event: nuove-foto ────────┤──── event: nuove-foto ──►│
    │    (inserita in cima)        │    (inserita in cima)    │
    │                              │                          │
    │  [A elimina una foto]        │                          │
    │                              │  SELECT foto_eliminate   │
    │◄── event: foto-eliminata ────┤── event: foto-eliminata ►│
    │    (animazione + remove)     │   (animazione + remove)  │
    │                              │                          │
    │  [B mette like a una foto]   │                          │
    │                              │  SELECT like_foto diff   │
    │◄── event: like-aggiornato ───┤── event: like-aggiornato►│
    │    (contatore aggiornato)    │   (contatore aggiornato) │
    │                              │                          │
    │  [A reagisce con 🎉]         │                          │
    │                              │  SELECT reazioni diff    │
    │◄── event: reazioni-aggiorn.──┤── event: reazioni-aggiorn►│
    │    (bubble aggiornate)       │   (bubble aggiornate)    │
```

- Il server controlla il DB ogni **1 secondo**
- Alla riconnessione il browser invia automaticamente `Last-Event-ID` — nessun evento viene perso
- Se SSE non è disponibile o fallisce dopo 3 tentativi, l'app degrada automaticamente a **polling ogni 5 secondi**
- La connessione SSE viene sospesa quando la tab non è visibile e ripristinata al ritorno

---

## API Reference

### Utenti

```
POST /PHP/api-users.php?action=register
Body: { "username": "Celeste" }
→ { "successo": true, "id": 1, "username": "Celeste", "nuovo": true }
```

### Foto

```
GET  /PHP/photos.php?utente_id=1
→ { "successo": true, "foto": [ { "id": 1, "percorso": "...", "like": 3, "user_liked": false, ... } ] }

POST /PHP/upload.php
FormData: { "utente_id": 1, "foto[]": [File, ...] }
→ { "successo": true, "caricate": 2, "foto": [...] }

POST /PHP/api-photos.php?action=delete
Body: { "foto_id": 5, "utente_id": 1 }
→ { "successo": true }
```

### Like

```
POST /PHP/api-likes.php?action=toggle
Body: { "foto_id": 5, "utente_id": 1 }
→ { "successo": true, "liked": true, "total_like": 4 }
```

### SSE

```
GET /PHP/events.php?utente_id=1&lastId=42&lastDeleteId=7
→ text/event-stream

event: nuove-foto
data: { "foto": [ {...} ] }

event: foto-eliminata
data: { "ids": [12, 15] }

event: like-aggiornato
data: { "like": [ { "foto_id": 5, "total_like": 4, "user_liked": true } ] }

event: reazioni-aggiornate
data: { "aggiornamenti": [ { "foto_id": 5, "reazioni": [ { "emoji": "🎉", "count": 2, "user_reacted": true } ] } ] }
```

### Reazioni

```
POST /PHP/api-reactions.php?action=toggle
Body: { "foto_id": 5, "utente_id": 1, "emoji": "🎉" }
→ { "successo": true, "user_emoji": "🎉", "reazioni": [ { "emoji": "🎉", "count": 1, "user_reacted": true } ] }
```

---

## Formati file supportati

| Tipo | Estensioni | Limite |
|---|---|---|
| Immagini | JPG, PNG, WEBP, HEIC, HEIF | 50 MB |
| Video | MP4, MOV, WEBM | 50 MB |

I file HEIC/HEIF (formato iPhone) vengono convertiti in JPEG direttamente nel browser prima dell'upload.

---

## Sicurezza

- **SQL Injection** — query preparate PDO su tutti gli endpoint
- **Upload** — validazione MIME type server-side + nome file generato con hash casuale
- **Autorizzazione** — un utente può eliminare solo le proprie foto (controllo `utente_id` lato server)
- **XSS** — escape di tutto l'HTML dinamico nel feed

---

## Personalizzazione rapida

**Cambiare nome e numero** — modifica direttamente in [index.html](index.html):
```html
<div class="numero">18</div>
<div class="nome">Celeste</div>
```

**Cambiare colore principale** — cerca `#1a3a6e` in [style.css](style.css) e sostituiscilo.

**Limite upload** — in [PHP/config.php](PHP/config.php):
```php
define('UPLOAD_MAX_SIZE', 50 * 1024 * 1024); // byte
```

**Intervallo SSE** — in [PHP/events.php](PHP/events.php):
```php
sleep(1); // secondi tra un controllo DB e l'altro
```

---

## Troubleshooting

**Il feed non si aggiorna in tempo reale**
- Verifica che `mod_deflate` non stia comprimendo la risposta SSE (il PHP già invia `Content-Encoding: identity`)
- Controlla che Apache non abbia un timeout di connessione inferiore a 30 s
- Apri la console del browser (F12 → Network → `events.php`) e verifica che la connessione rimanga aperta

**Errore connessione database**
- Assicurati che MySQL sia avviato in XAMPP
- Verifica le credenziali in `PHP/config.php`
- Controlla che il database `compleanno_amore` esista

**Le foto HEIC non vengono caricate**
- La conversione avviene nel browser tramite CDN — verifica la connessione internet
- Su Safari iOS il formato è già nativo, non serve conversione

**La cartella uploads non è scrivibile**
```bash
# Linux/Mac
chmod 755 uploads/

# Windows: tasto destro sulla cartella → Proprietà → Sicurezza → Modifica → aggiungi controllo completo
```

---

## Licenza

MIT — sentiti libero di adattarlo per il compleanno di chiunque tu voglia 🎉
