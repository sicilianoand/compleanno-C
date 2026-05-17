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
    // Riconnessione: usa il cursore memorizzato nell'id SSE
    [$lastId, $lastDeleteId] = array_map('intval', explode(',', $lastEventId, 2));
} else {
    $lastId            = (int)(isset($_GET['lastId'])       && is_numeric($_GET['lastId'])       ? $_GET['lastId']       : 0);
    $lastDeleteId      = (int)(isset($_GET['lastDeleteId']) && is_numeric($_GET['lastDeleteId']) ? $_GET['lastDeleteId'] : 0);
    $primaConnessione  = true; // usato dopo l'apertura del DB
}

try {
    $pdo = getDBConnection();

    $pdo->exec('CREATE TABLE IF NOT EXISTS reazioni (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        foto_id    INT NOT NULL,
        utente_id  INT NOT NULL,
        emoji      VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reazione (foto_id, utente_id),
        KEY idx_foto (foto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    // Fix emoji column collation if created under utf8mb4_unicode_ci (UCA 4.0 assigns
    // the same default weight to all post-Unicode-4.0 emoji, merging GROUP BY counts).
    $chkCol = $pdo->query(
        "SELECT COLLATION_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'reazioni'
           AND COLUMN_NAME  = 'emoji'"
    );
    if ($chkCol->fetchColumn() !== 'utf8mb4_bin') {
        $pdo->exec('ALTER TABLE reazioni MODIFY COLUMN emoji VARCHAR(20)
                    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
    }

    // Verify the UNIQUE KEY covers (foto_id, utente_id) — not just (foto_id).
    $chk = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'reazioni'
           AND INDEX_NAME   = 'uq_reazione'
           AND COLUMN_NAME IN ('foto_id', 'utente_id')"
    );
    if ((int)$chk->fetchColumn() !== 2) {
        try { $pdo->exec('ALTER TABLE reazioni DROP INDEX uq_reazione'); } catch (Exception $e) {}
        $pdo->exec('DELETE r1 FROM reazioni r1
                    INNER JOIN reazioni r2
                    WHERE r1.foto_id   = r2.foto_id
                      AND r1.utente_id = r2.utente_id
                      AND r1.id < r2.id');
        $pdo->exec('ALTER TABLE reazioni ADD UNIQUE KEY uq_reazione (foto_id, utente_id)');
    }

    // Pulizia reazioni orfane (foto già eliminate prima che il cascade fosse implementato)
    $pdo->exec('DELETE r FROM reazioni r LEFT JOIN foto f ON r.foto_id = f.id WHERE f.id IS NULL');

    // Crea la tabella di log eliminazioni se non esiste ancora
    $pdo->exec('CREATE TABLE IF NOT EXISTS foto_eliminate (
        id INT AUTO_INCREMENT PRIMARY KEY,
        foto_id INT NOT NULL,
        eliminata_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // Prima connessione (nessun Last-Event-ID): ignora le eliminazioni storiche.
    // Il feed è già stato costruito da photos.php escludendo le foto cancellate;
    // rimandare le vecchie voci di foto_eliminate potrebbe coincidere con nuovi
    // photo_id (es. dopo un TRUNCATE + AUTO_INCREMENT reset) e rimuovere foto attive.
    if (!empty($primaConnessione) && $lastDeleteId === 0) {
        $stmt = $pdo->query('SELECT COALESCE(MAX(id), 0) FROM foto_eliminate');
        $lastDeleteId = (int)$stmt->fetchColumn();
    }

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

// Snapshot iniziale delle reazioni (foto_id => [emoji => count], chiavi ordinate).
$reazioniSnapshot = [];
try {
    $stmt = $pdo->query('SELECT foto_id, emoji, COUNT(*) AS cnt FROM reazioni GROUP BY foto_id, emoji');
    foreach ($stmt->fetchAll() as $r) {
        $fid = (int)$r['foto_id'];
        if (!isset($reazioniSnapshot[$fid])) $reazioniSnapshot[$fid] = [];
        $reazioniSnapshot[$fid][$r['emoji']] = (int)$r['cnt'];
    }
    foreach ($reazioniSnapshot as &$map) ksort($map);
    unset($map);
} catch (Exception $e) { /* ignora se tabella non esiste */ }

// Snapshot iniziale dei like (foto_id => total_like).
// Pre-popolato per evitare che il primo tick invii tutto come "cambiato".
$likeSnapshot = [];
try {
    $stmtInit = $pdo->query('SELECT foto_id, COUNT(*) AS total FROM like_foto GROUP BY foto_id');
    foreach ($stmtInit->fetchAll() as $r) {
        $likeSnapshot[(int)$r['foto_id']] = (int)$r['total'];
    }
} catch (Exception $e) { /* ignora — snapshot rimane vuoto */ }

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

        // ── Like aggiornati ─────────────────────────────────────────
        if ($utenteId !== null) {
            $stmt = $pdo->prepare(
                'SELECT foto_id,
                        COUNT(*) AS total_like,
                        SUM(utente_id = ?) AS user_liked
                 FROM like_foto GROUP BY foto_id'
            );
            $stmt->execute([$utenteId]);
        } else {
            $stmt = $pdo->query(
                'SELECT foto_id, COUNT(*) AS total_like, 0 AS user_liked
                 FROM like_foto GROUP BY foto_id'
            );
        }

        $likeAttuali = [];
        foreach ($stmt->fetchAll() as $r) {
            $likeAttuali[(int)$r['foto_id']] = [
                'total' => (int)$r['total_like'],
                'liked' => (bool)$r['user_liked'],
            ];
        }

        $cambiati = [];
        foreach ($likeAttuali as $fotoId => $data) {
            $prevTotal = $likeSnapshot[$fotoId] ?? -1;
            if ($prevTotal !== $data['total']) {
                $cambiati[] = [
                    'foto_id'    => $fotoId,
                    'total_like' => $data['total'],
                    'user_liked' => $data['liked'],
                ];
            }
        }
        // Foto i cui like sono scesi a 0 (sparite da like_foto)
        foreach ($likeSnapshot as $fotoId => $total) {
            if (!isset($likeAttuali[$fotoId])) {
                $cambiati[] = ['foto_id' => $fotoId, 'total_like' => 0, 'user_liked' => false];
            }
        }

        if (!empty($cambiati)) {
            sseEvent('like-aggiornato', ['like' => $cambiati], "{$lastId},{$lastDeleteId}");
        }

        $likeSnapshot = array_map(fn($d) => $d['total'], $likeAttuali);

        // ── Reazioni aggiornate ──────────────────────────────────────
        $fotoCambiate = [];
        try {
            $stmt = $pdo->query(
                'SELECT foto_id, emoji, COUNT(*) AS cnt FROM reazioni GROUP BY foto_id, emoji'
            );
            $reazioniAttuali = [];
            foreach ($stmt->fetchAll() as $r) {
                $fid = (int)$r['foto_id'];
                if (!isset($reazioniAttuali[$fid])) $reazioniAttuali[$fid] = [];
                $reazioniAttuali[$fid][$r['emoji']] = (int)$r['cnt'];
            }
            foreach ($reazioniAttuali as &$map) ksort($map);
            unset($map);

            foreach ($reazioniAttuali as $fid => $map) {
                if (!isset($reazioniSnapshot[$fid]) || $reazioniSnapshot[$fid] !== $map) {
                    $fotoCambiate[] = $fid;
                }
            }
            foreach ($reazioniSnapshot as $fid => $_) {
                if (!isset($reazioniAttuali[$fid])) $fotoCambiate[] = $fid;
            }

            if (!empty($fotoCambiate)) {
                $userReazioni = [];
                if ($utenteId !== null) {
                    $ph   = implode(',', array_fill(0, count($fotoCambiate), '?'));
                    $stmt = $pdo->prepare(
                        "SELECT foto_id, emoji FROM reazioni WHERE utente_id = ? AND foto_id IN ($ph)"
                    );
                    $stmt->execute(array_merge([$utenteId], $fotoCambiate));
                    foreach ($stmt->fetchAll() as $r) {
                        $userReazioni[(int)$r['foto_id']] = $r['emoji'];
                    }
                }

                $payload = [];
                foreach ($fotoCambiate as $fid) {
                    $map       = $reazioniAttuali[$fid] ?? [];
                    $userEmoji = $userReazioni[$fid] ?? null;
                    arsort($map); // ordina per count desc
                    $reazioni  = [];
                    foreach ($map as $emoji => $cnt) {
                        $reazioni[] = [
                            'emoji'        => $emoji,
                            'count'        => $cnt,
                            'user_reacted' => ($emoji === $userEmoji),
                        ];
                    }
                    $payload[] = ['foto_id' => $fid, 'reazioni' => $reazioni];
                }

                sseEvent('reazioni-aggiornate', ['aggiornamenti' => $payload], "{$lastId},{$lastDeleteId}");
            }

            $reazioniSnapshot = $reazioniAttuali;

        } catch (Exception $e) { /* ignora se tabella non ancora creata */ }

        // Heartbeat se non è successo nulla
        if (empty($nuove) && empty($eliminate) && empty($cambiati) && empty($fotoCambiate)) {
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
