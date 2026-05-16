<?php
/**
 * API Sistema Like
 * Toggle like, conteggio, persistenza database
 */

require_once 'config.php';

$action = $_GET['action'] ?? null;

// ============================================================================
// POST: Toggle like (aggiungi/rimuovi)
// ============================================================================
if ($action === 'toggle' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleToggleLike();
}

// ============================================================================
// GET: Conta like per foto
// ============================================================================
elseif ($action === 'count' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    handleCountLikes();
}

else {
    jsonResponse(['errore' => 'Azione non valida'], 400);
}

// ============================================================================
// HANDLER: Toggle Like
// ============================================================================
function handleToggleLike() {
    $input = json_decode(file_get_contents('php://input'), true);
    $fotoId = $input['foto_id'] ?? null;
    $utenteId = $input['utente_id'] ?? null;

    // Validazione
    if (empty($fotoId) || empty($utenteId) || !is_numeric($fotoId) || !is_numeric($utenteId)) {
        jsonResponse(['errore' => 'Parametri non validi'], 400);
    }

    $fotoId = (int)$fotoId;
    $utenteId = (int)$utenteId;

    try {
        $pdo = getDBConnection();

        // Verifica che foto esista
        $stmt = $pdo->prepare('SELECT id FROM foto WHERE id = ?');
        $stmt->execute([$fotoId]);
        if (!$stmt->fetch()) {
            jsonResponse(['errore' => 'Foto non trovata'], 404);
        }

        // Verifica che utente esista
        $stmt = $pdo->prepare('SELECT id FROM utenti WHERE id = ?');
        $stmt->execute([$utenteId]);
        if (!$stmt->fetch()) {
            jsonResponse(['errore' => 'Utente non trovato'], 404);
        }

        // Controlla se like esiste
        $stmt = $pdo->prepare('SELECT id FROM like_foto WHERE foto_id = ? AND utente_id = ?');
        $stmt->execute([$fotoId, $utenteId]);
        $likeExists = $stmt->fetch();

        if ($likeExists) {
            // Rimuovi like
            $stmt = $pdo->prepare('DELETE FROM like_foto WHERE foto_id = ? AND utente_id = ?');
            $stmt->execute([$fotoId, $utenteId]);
            $liked = false;
        } else {
            // Aggiungi like
            $stmt = $pdo->prepare('INSERT INTO like_foto (foto_id, utente_id) VALUES (?, ?)');
            $stmt->execute([$fotoId, $utenteId]);
            $liked = true;
        }

        // Conta totale like
        $stmt = $pdo->prepare('SELECT COUNT(*) as total FROM like_foto WHERE foto_id = ?');
        $stmt->execute([$fotoId]);
        $result = $stmt->fetch();
        $totalLike = (int)$result['total'];

        jsonResponse([
            'successo' => true,
            'liked' => $liked,
            'total_like' => $totalLike
        ]);

    } catch (Exception $e) {
        error_log('Errore toggle like: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}

// ============================================================================
// HANDLER: Conta Like
// ============================================================================
function handleCountLikes() {
    $fotoId = $_GET['foto_id'] ?? null;
    $utenteId = $_GET['utente_id'] ?? null;

    if (empty($fotoId) || !is_numeric($fotoId)) {
        jsonResponse(['errore' => 'ID foto non valido'], 400);
    }

    $fotoId = (int)$fotoId;
    $utenteId = !empty($utenteId) && is_numeric($utenteId) ? (int)$utenteId : null;

    try {
        $pdo = getDBConnection();

        // Conta totale like per foto
        $stmt = $pdo->prepare('SELECT COUNT(*) as total FROM like_foto WHERE foto_id = ?');
        $stmt->execute([$fotoId]);
        $result = $stmt->fetch();
        $totalLike = (int)$result['total'];

        // Controlla se l'utente corrente ha messo like
        $userLiked = false;
        if ($utenteId !== null) {
            $stmt = $pdo->prepare('SELECT id FROM like_foto WHERE foto_id = ? AND utente_id = ?');
            $stmt->execute([$fotoId, $utenteId]);
            $userLiked = (bool)$stmt->fetch();
        }

        jsonResponse([
            'successo' => true,
            'total_like' => $totalLike,
            'user_liked' => $userLiked
        ]);

    } catch (Exception $e) {
        error_log('Errore conteggio like: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}
