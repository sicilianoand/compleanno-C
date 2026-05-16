<?php
/**
 * API Gestione Foto
 * Eliminazione foto (solo dell'utente proprietario)
 */

require_once 'config.php';

$action = $_GET['action'] ?? null;

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleDeletePhoto();
} else {
    jsonResponse(['errore' => 'Azione non valida'], 400);
}

function handleDeletePhoto() {
    $input = json_decode(file_get_contents('php://input'), true);
    $fotoId = $input['foto_id'] ?? null;
    $utenteId = $input['utente_id'] ?? null;

    if (empty($fotoId) || empty($utenteId) || !is_numeric($fotoId) || !is_numeric($utenteId)) {
        jsonResponse(['errore' => 'Parametri non validi'], 400);
    }

    $fotoId = (int)$fotoId;
    $utenteId = (int)$utenteId;

    try {
        $pdo = getDBConnection();

        $stmt = $pdo->prepare('SELECT percorso, utente_id FROM foto WHERE id = ?');
        $stmt->execute([$fotoId]);
        $foto = $stmt->fetch();

        if (!$foto) {
            jsonResponse(['errore' => 'Foto non trovata'], 404);
        }

        if ((int)$foto['utente_id'] !== $utenteId) {
            jsonResponse(['errore' => 'Non autorizzato: puoi eliminare solo le tue foto'], 403);
        }

        $percorso = dirname(__DIR__) . '/' . $foto['percorso'];

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('DELETE FROM like_foto WHERE foto_id = ?');
        $stmt->execute([$fotoId]);

        $stmt = $pdo->prepare('DELETE FROM foto WHERE id = ?');
        $stmt->execute([$fotoId]);

        // Log per SSE — notifica tutti i client connessi in tempo reale
        $pdo->exec('CREATE TABLE IF NOT EXISTS foto_eliminate (
            id INT AUTO_INCREMENT PRIMARY KEY,
            foto_id INT NOT NULL,
            eliminata_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $stmt = $pdo->prepare('INSERT INTO foto_eliminate (foto_id) VALUES (?)');
        $stmt->execute([$fotoId]);

        $pdo->commit();

        if (file_exists($percorso)) {
            @unlink($percorso);
        }

        jsonResponse([
            'successo' => true,
            'messaggio' => 'Foto eliminata con successo'
        ]);

    } catch (Exception $e) {
        error_log('Errore eliminazione foto: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}
