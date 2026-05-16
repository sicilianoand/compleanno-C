<?php
/**
 * API Recupero Foto
 * Ritorna lista foto dal database con username autore
 */

require_once 'config.php';

try {
    $pdo = getDBConnection();

    // Recupera foto ordinate per data (più recenti prima)
    $stmt = $pdo->query(
        'SELECT
            f.id,
            f.percorso,
            f.tipo_file,
            f.created_at,
            u.username,
            (SELECT COUNT(*) FROM like_foto WHERE foto_id = f.id) as total_like
         FROM foto f
         JOIN utenti u ON f.utente_id = u.id
         ORDER BY f.created_at DESC'
    );

    $foto = $stmt->fetchAll();

    // Trasforma risultati
    $result = array_map(function ($item) {
        return [
            'id' => (int)$item['id'],
            'percorso' => $item['percorso'],
            'tipo' => $item['tipo_file'],
            'username' => $item['username'],
            'data' => $item['created_at'],
            'like' => (int)$item['total_like']
        ];
    }, $foto);

    jsonResponse(['successo' => true, 'foto' => $result]);

} catch (Exception $e) {
    error_log("Errore recupero foto: " . $e->getMessage());
    jsonResponse(['errore' => 'Errore lettura foto'], 500);
}
