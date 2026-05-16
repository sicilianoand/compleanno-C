<?php
/**
 * API Caricamento Foto - VERSIONE CORRETTA
 * Validazione sicura, sanitizzazione file, inserimento database
 */

require_once 'config.php';

// Verifica che sia POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['errore' => 'Metodo non consentito'], 405);
}

// Verifica foto ricevute
if (!isset($_FILES['foto']) || empty($_FILES['foto']['name'][0])) {
    jsonResponse(['errore' => 'Nessuna foto ricevuta'], 400);
}

// Ottieni ID utente
$userId = $_POST['utente_id'] ?? null;
if (empty($userId) || !is_numeric($userId)) {
    jsonResponse(['errore' => 'ID utente non valido'], 400);
}

$userId = (int)$userId;
$fotoCaricate = [];
$fotoFallite = [];

try {
    $pdo = getDBConnection();

    // Verifica che l'utente esista
    $stmt = $pdo->prepare('SELECT id FROM utenti WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        jsonResponse(['errore' => 'Utente non trovato'], 404);
    }

    // Processa ogni file caricato
    $numFile = count($_FILES['foto']['name']);

    for ($i = 0; $i < $numFile; $i++) {
        // Salta file vuoti o con errore
        if ($_FILES['foto']['error'][$i] !== UPLOAD_ERR_OK) {
            $fotoFallite[] = "File {$i}: Errore upload (" . $_FILES['foto']['error'][$i] . ")";
            continue;
        }

        $tmpFile = $_FILES['foto']['tmp_name'][$i];
        $nomeOrigine = basename($_FILES['foto']['name'][$i]);
        $dimensione = $_FILES['foto']['size'][$i];

        // Validazione dimensione
        if ($dimensione > UPLOAD_MAX_SIZE) {
            $fotoFallite[] = "$nomeOrigine: File troppo grande (max " . (UPLOAD_MAX_SIZE / 1024 / 1024) . "MB)";
            continue;
        }

        // Ottieni MIME type del file temporaneo
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $tmpFile);
        finfo_close($finfo);

        // Validazione MIME type
        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            $fotoFallite[] = "$nomeOrigine: Tipo file non consentito ($mimeType)";
            continue;
        }

        // Determina estensione corretta dal MIME type
        $estensione = getMimeExtension($mimeType);
        if (!$estensione) {
            $fotoFallite[] = "$nomeOrigine: Impossibile determinare estensione";
            continue;
        }

        // Genera nome file univoco e sicuro
        $nomeFile = generateSecureFilename($estensione);
        $percorsoDestinazione = UPLOAD_DIR . $nomeFile;

        // Sposta file temporaneo
        if (!move_uploaded_file($tmpFile, $percorsoDestinazione)) {
            $fotoFallite[] = "$nomeOrigine: Errore spostamento file";
            @unlink($tmpFile); // Pulisci file temporaneo
            continue;
        }

        // Imposta permessi file
        chmod($percorsoDestinazione, 0644);

        // Inserisci nel database
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO foto (utente_id, nome_file, percorso, tipo_file, dimensione)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $nomeOrigine,
                'uploads/' . $nomeFile,
                $mimeType,
                $dimensione
            ]);

            $fotoId = $pdo->lastInsertId();
            $fotoCaricate[] = [
                'id' => (int)$fotoId,
                'nome' => $nomeOrigine,
                'percorso' => 'uploads/' . $nomeFile,
                'tipo' => $mimeType
            ];

        } catch (Exception $e) {
            // Se l'inserimento fallisce, elimina il file
            @unlink($percorsoDestinazione);
            $fotoFallite[] = "$nomeOrigine: Errore database";
            error_log("Errore DB upload: " . $e->getMessage());
        }
    }

    // Ritorna risposta
    jsonResponse([
        'successo' => count($fotoCaricate) > 0,
        'caricate' => count($fotoCaricate),
        'fallite' => count($fotoFallite),
        'foto' => $fotoCaricate,
        'errori' => $fotoFallite
    ]);

} catch (Exception $e) {
    error_log("Errore upload: " . $e->getMessage());
    jsonResponse(['errore' => 'Errore server durante caricamento'], 500);
}

/**
 * Converte MIME type in estensione sicura
 */
function getMimeExtension($mimeType) {
    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov'
    ];
    return $mimeMap[$mimeType] ?? null;
}

/**
 * Genera nome file sicuro con hash
 */
function generateSecureFilename($estensione) {
    // Usa hash SHA256 del timestamp + random per garantire unicità
    $hash = bin2hex(random_bytes(16));
    return 'foto_' . $hash . '.' . $estensione;
}