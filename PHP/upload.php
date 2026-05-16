<?php
/**
 * API Caricamento Foto
 * Validazione sicura, sanitizzazione file, inserimento database
 */

require_once 'config.php';

// Permetti richieste cross-origin se necessario (utile in sviluppo locale)
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['errore' => 'Metodo non consentito'], 405);
}

if (!isset($_FILES['foto']) || empty($_FILES['foto']['name'][0])) {
    jsonResponse(['errore' => 'Nessuna foto ricevuta'], 400);
}

$userId = $_POST['utente_id'] ?? null;
if (empty($userId) || !is_numeric($userId)) {
    jsonResponse(['errore' => 'ID utente non valido'], 400);
}

$userId      = (int)$userId;
$fotoCaricate = [];
$fotoFallite  = [];

try {
    $pdo = getDBConnection();

    $stmt = $pdo->prepare('SELECT id FROM utenti WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        jsonResponse(['errore' => 'Utente non trovato'], 404);
    }

    $numFile = count($_FILES['foto']['name']);

    for ($i = 0; $i < $numFile; $i++) {
        if ($_FILES['foto']['error'][$i] !== UPLOAD_ERR_OK) {
            $fotoFallite[] = "File {$i}: Errore upload (" . $_FILES['foto']['error'][$i] . ")";
            continue;
        }

        $tmpFile    = $_FILES['foto']['tmp_name'][$i];
        $nomeOrigine = basename($_FILES['foto']['name'][$i]);
        $dimensione  = $_FILES['foto']['size'][$i];

        if ($dimensione > UPLOAD_MAX_SIZE) {
            $fotoFallite[] = "$nomeOrigine: File troppo grande (max " . (UPLOAD_MAX_SIZE / 1024 / 1024) . "MB)";
            continue;
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $tmpFile);
        finfo_close($finfo);

        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            $fotoFallite[] = "$nomeOrigine: Tipo file non consentito ($mimeType)";
            continue;
        }

        $estensione = getMimeExtension($mimeType);
        if (!$estensione) {
            $fotoFallite[] = "$nomeOrigine: Impossibile determinare estensione";
            continue;
        }

        $nomeFile             = generateSecureFilename($estensione);
        $percorsoDestinazione = UPLOAD_DIR . $nomeFile;

        if (!move_uploaded_file($tmpFile, $percorsoDestinazione)) {
            $fotoFallite[] = "$nomeOrigine: Errore spostamento file";
            continue;
        }

        chmod($percorsoDestinazione, 0644);

        // Percorso relativo a index.html (nella root del progetto)
        // index.html è in /  →  uploads/ è in /uploads/
        $percorsoRelativo = 'uploads/' . $nomeFile;

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO foto (utente_id, nome_file, percorso, tipo_file, dimensione)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $nomeOrigine,
                $percorsoRelativo,
                $mimeType,
                $dimensione
            ]);

            $fotoId       = $pdo->lastInsertId();
            $fotoCaricate[] = [
                'id'      => (int)$fotoId,
                'nome'    => $nomeOrigine,
                'percorso' => $percorsoRelativo,
                'tipo'    => $mimeType
            ];

        } catch (Exception $e) {
            @unlink($percorsoDestinazione);
            $fotoFallite[] = "$nomeOrigine: Errore database";
            error_log("Errore DB upload: " . $e->getMessage());
        }
    }

    jsonResponse([
        'successo' => count($fotoCaricate) > 0,
        'caricate' => count($fotoCaricate),
        'fallite'  => count($fotoFallite),
        'foto'     => $fotoCaricate,
        'errori'   => $fotoFallite
    ]);

} catch (Exception $e) {
    error_log("Errore upload: " . $e->getMessage());
    jsonResponse(['errore' => 'Errore server durante caricamento'], 500);
}

function getMimeExtension($mimeType) {
    $mimeMap = [
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'image/webp'      => 'webp',
        'video/mp4'       => 'mp4',
        'video/webm'      => 'webm',
        'video/quicktime' => 'mov'
    ];
    return $mimeMap[$mimeType] ?? null;
}

function generateSecureFilename($estensione) {
    $hash = bin2hex(random_bytes(16));
    return 'foto_' . $hash . '.' . $estensione;
}