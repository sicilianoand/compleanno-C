<?php
/**
 * Server-Sent Events — aggiornamenti feed in tempo reale.
 * Invia eventi per nuove foto e per foto eliminate.
 * L'id SSE usa il formato "lastPhotoId,lastDeleteId" per supportare
 * la riconnessione automatica del browser senza perdere eventi.
 */

require_once 'config.php';

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Content-Encoding: identity'); // disabilita gzip — blocca il flush SSE

while (ob_get_level()) ob_end_clean();
ob_implicit_flush(true);

set_time_limit(0);
ignore_user_abort(true);

$utenteId = isset($_GET['utente_id']) && is_numeric($_GET['utente_id'])
    ? (int)$_GET['utente_id']
    : null;

// Riconnessione automatica: il browser invia Last-Event-ID nel formato "photoId,deleteId"
$lastEventId = $_SERVER['HTTP_LAST_EVENT_ID'] ?? null;
if ($lastEventId !== null && strpos($lastEventId, ',') !== false) {
    [$lastId, $lastDeleteId] = array_map('intval', explode(',', $lastEventId, 2));
} else {
    $lastId       = (int)(isset($_GET['lastId'])       && is_numeric($_GET['lastId'])       ? $_GET['lastId']       : 0);
    $lastDeleteId = (int)(isset($_GET['lastDeleteId']) && is_numeric($_GET['lastDeleteId']) ? $_GET['lastDeleteId'] : 0);
}

try {
    $pdo = getDBConnection();

    // Crea la tabella di log eliminazioni se non esiste ancora
    $pdo->exec('CREATE TABLE IF NOT EXISTS foto_eliminate (
        id INT AUTO_INCREMENT PRIMARY KEY,
        foto_id INT NOT NULL,
        eliminata_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

} catch (Exception $e) {
    echo "event: errore\ndata: {\"msg\":\"DB non disponibile\"}\n\n";
    flush();
    exit;
}

function sseEvent(string $event, $data, string $id): void {
    echo "id: {$id}\n";
    echo "event: {$event}\n";
    echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}

sseEvent('connected', ['ok' => true], "{$lastId},{$lastDeleteId}");

while (true) {
    if (connection_aborted()) break;

    try {
        // ── Nuove foto ──────────────────────────────────────────────
        if ($utenteId !== null) {
            $stmt = $pdo->prepare(
                'SELECT f.id, f.percorso, f.tipo_file, f.created_at, u.username,
                    (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id) AS total_like,
                    (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id AND utente_id = :uid) AS user_liked
                 FROM foto f JOIN utenti u ON f.utente_id = u.id
                 WHERE f.id > :lastId ORDER BY f.id ASC'
            );
            $stmt->execute([':lastId' => $lastId, ':uid' => $utenteId]);
        } else {
            $stmt = $pdo->prepare(
                'SELECT f.id, f.percorso, f.tipo_file, f.created_at, u.username,
                    (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id) AS total_like,
                    0 AS user_liked
                 FROM foto f JOIN utenti u ON f.utente_id = u.id
                 WHERE f.id > :lastId ORDER BY f.id ASC'
            );
            $stmt->execute([':lastId' => $lastId]);
        }

        $nuove = $stmt->fetchAll();
        if (!empty($nuove)) {
            $foto = array_map(fn($r) => [
                'id'         => (int)$r['id'],
                'percorso'   => $r['percorso'],
                'tipo'       => $r['tipo_file'],
                'username'   => $r['username'],
                'data'       => $r['created_at'],
                'like'       => (int)$r['total_like'],
                'user_liked' => (bool)$r['user_liked'],
            ], $nuove);

            $lastId = (int)end($nuove)['id'];
            sseEvent('nuove-foto', ['foto' => $foto], "{$lastId},{$lastDeleteId}");
        }

        // ── Foto eliminate ───────────────────────────────────────────
        $stmt = $pdo->prepare(
            'SELECT id, foto_id FROM foto_eliminate WHERE id > :lastDeleteId ORDER BY id ASC'
        );
        $stmt->execute([':lastDeleteId' => $lastDeleteId]);
        $eliminate = $stmt->fetchAll();

        if (!empty($eliminate)) {
            $ids = array_map(fn($r) => (int)$r['foto_id'], $eliminate);
            $lastDeleteId = (int)end($eliminate)['id'];
            sseEvent('foto-eliminata', ['ids' => $ids], "{$lastId},{$lastDeleteId}");
        }

        // Heartbeat se non è successo nulla
        if (empty($nuove) && empty($eliminate)) {
            echo ": heartbeat\n\n";
            flush();
        }

    } catch (Exception $e) {
        error_log('SSE error: ' . $e->getMessage());
        sseEvent('errore', ['msg' => 'Errore server'], "{$lastId},{$lastDeleteId}");
        break;
    }

    sleep(1);
}
