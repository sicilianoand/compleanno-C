<?php
/**
 * API Reazioni Emoji
 * Toggle reazione su una foto — un'emoji per utente per foto.
 * Stesso emoji → rimuove; emoji diversa → cambia.
 */

require_once 'config.php';

$action = $_GET['action'] ?? null;

if ($action === 'toggle' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleToggle();
} else {
    jsonResponse(['errore' => 'Azione non valida'], 400);
}

function garantisciCollazioneBin(PDO $pdo): void {
    // utf8mb4_unicode_ci (UCA 4.0) assigns the same default weight to all emoji added
    // after Unicode 4.0, making GROUP BY treat them as equal — counts merge across emoji.
    // utf8mb4_bin compares raw bytes, keeping every emoji distinct.
    $stmt = $pdo->query(
        "SELECT COLLATION_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'reazioni'
           AND COLUMN_NAME  = 'emoji'"
    );
    if ($stmt->fetchColumn() === 'utf8mb4_bin') return;
    $pdo->exec('ALTER TABLE reazioni MODIFY COLUMN emoji VARCHAR(20)
                CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
}

function garantisciVincoloUnico(PDO $pdo): void {
    // Verify that the UNIQUE KEY covers exactly (foto_id, utente_id).
    // Error 1061 "Duplicate key name" only proves the name exists, not which columns it covers.
    // A key defined on just (foto_id) would let any reaction overwrite another user's reaction.
    $stmt = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'reazioni'
           AND INDEX_NAME   = 'uq_reazione'
           AND COLUMN_NAME IN ('foto_id', 'utente_id')"
    );
    if ((int)$stmt->fetchColumn() === 2) return; // constraint is correct — nothing to do

    // Key is absent or covers wrong columns — drop it (if present) and rebuild correctly.
    try { $pdo->exec('ALTER TABLE reazioni DROP INDEX uq_reazione'); } catch (Exception $e) {}

    // Deduplicate existing rows before the constraint is added
    $pdo->exec('DELETE r1 FROM reazioni r1
                INNER JOIN reazioni r2
                WHERE r1.foto_id   = r2.foto_id
                  AND r1.utente_id = r2.utente_id
                  AND r1.id < r2.id');

    $pdo->exec('ALTER TABLE reazioni ADD UNIQUE KEY uq_reazione (foto_id, utente_id)');
}

function creaTabella(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS reazioni (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        foto_id    INT NOT NULL,
        utente_id  INT NOT NULL,
        emoji      VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reazione (foto_id, utente_id),
        KEY idx_foto (foto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    garantisciCollazioneBin($pdo);
    garantisciVincoloUnico($pdo);
}

function handleToggle(): void {
    $input    = json_decode(file_get_contents('php://input'), true);
    $fotoId   = $input['foto_id']   ?? null;
    $utenteId = $input['utente_id'] ?? null;
    $emoji    = $input['emoji']     ?? null;

    if (empty($fotoId) || empty($utenteId) || !is_numeric($fotoId) || !is_numeric($utenteId) || empty($emoji)) {
        jsonResponse(['errore' => 'Parametri non validi'], 400);
    }

    $emoji    = mb_substr(trim($emoji), 0, 8, 'UTF-8');
    $fotoId   = (int)$fotoId;
    $utenteId = (int)$utenteId;

    try {
        $pdo = getDBConnection();
        creaTabella($pdo);

        // Check current reaction to handle toggle-off (same emoji = remove)
        $stmt = $pdo->prepare('SELECT emoji FROM reazioni WHERE foto_id = ? AND utente_id = ?');
        $stmt->execute([$fotoId, $utenteId]);
        $existing = $stmt->fetchColumn();

        if ($existing === $emoji) {
            // Same emoji tapped again → remove reaction
            $stmt = $pdo->prepare('DELETE FROM reazioni WHERE foto_id = ? AND utente_id = ?');
            $stmt->execute([$fotoId, $utenteId]);
            $userEmoji = null;
        } else {
            // New or changed emoji → atomic upsert (avoids race conditions and enforces one row per user/photo)
            $stmt = $pdo->prepare(
                'INSERT INTO reazioni (foto_id, utente_id, emoji) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), created_at = NOW()'
            );
            $stmt->execute([$fotoId, $utenteId, $emoji]);
            $userEmoji = $emoji;
        }

        $stmt = $pdo->prepare(
            'SELECT emoji, COUNT(*) AS cnt FROM reazioni WHERE foto_id = ? GROUP BY emoji ORDER BY cnt DESC'
        );
        $stmt->execute([$fotoId]);

        $reazioni = array_map(fn($r) => [
            'emoji'        => $r['emoji'],
            'count'        => (int)$r['cnt'],
            'user_reacted' => $r['emoji'] === $userEmoji,
        ], $stmt->fetchAll());

        jsonResponse(['successo' => true, 'user_emoji' => $userEmoji, 'reazioni' => $reazioni]);

    } catch (Exception $e) {
        error_log('Errore reazione: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}
