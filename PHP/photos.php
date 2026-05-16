<?php
/**
 * API Recupero Foto
 * Ritorna lista foto dal database con username autore e stato liked dell'utente
 */

require_once 'config.php';

try {
    $pdo = getDBConnection();

    // Accetta utente_id opzionale per sapere quali foto ha già messo like
    $utenteId = isset($_GET['utente_id']) && is_numeric($_GET['utente_id'])
        ? (int)$_GET['utente_id']
        : null;

    if ($utenteId !== null) {
        $stmt = $pdo->prepare(
            'SELECT
                f.id,
                f.percorso,
                f.tipo_file,
                f.created_at,
                u.username,
                (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id) AS total_like,
                (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id AND utente_id = ?) AS user_liked
             FROM foto f
             JOIN utenti u ON f.utente_id = u.id
             ORDER BY f.created_at DESC'
        );
        $stmt->execute([$utenteId]);
    } else {
        $stmt = $pdo->query(
            'SELECT
                f.id,
                f.percorso,
                f.tipo_file,
                f.created_at,
                u.username,
                (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id) AS total_like,
                0 AS user_liked
             FROM foto f
             JOIN utenti u ON f.utente_id = u.id
             ORDER BY f.created_at DESC'
        );
    }

    $foto = $stmt->fetchAll();

    $result = array_map(function ($item) {
        return [
            'id'         => (int)$item['id'],
            // Il percorso è già salvato come "uploads/nomefile" → corretto per index.html nella root
            'percorso'   => $item['percorso'],
            'tipo'       => $item['tipo_file'],
            'username'   => $item['username'],
            'data'       => $item['created_at'],
            'like'       => (int)$item['total_like'],
            'user_liked' => (bool)$item['user_liked']
        ];
    }, $foto);

    jsonResponse(['successo' => true, 'foto' => $result]);

} catch (Exception $e) {
    error_log("Errore recupero foto: " . $e->getMessage());
    jsonResponse(['errore' => 'Errore lettura foto'], 500);
}