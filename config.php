<?php
/**
 * Configurazione Database e Costanti
 * File centrale per credenziali e impostazioni globali
 */

// ============================================================================
// CREDENZIALI DATABASE
// ============================================================================
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'compleanno_amore');

// ============================================================================
// IMPOSTAZIONI UPLOAD
// ============================================================================
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('UPLOAD_MAX_SIZE', 50 * 1024 * 1024); // 50 MB

// MIME types consentiti
define('ALLOWED_MIME_TYPES', [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
]);

// ============================================================================
// CONNESSIONE DATABASE (Singleton Pattern)
// ============================================================================
$_pdo_instance = null;

function getDBConnection() {
    global $_pdo_instance;

    if ($_pdo_instance !== null) {
        return $_pdo_instance;
    }

    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $_pdo_instance = new PDO(
            $dsn,
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );
        return $_pdo_instance;
    } catch (PDOException $e) {
        jsonResponse(['errore' => 'Errore connessione database'], 500);
        exit;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Invia risposta JSON e termina esecuzione
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Crea cartella upload se non esiste
 */
function ensureUploadDir() {
    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0755, true);
    }
}

ensureUploadDir();
