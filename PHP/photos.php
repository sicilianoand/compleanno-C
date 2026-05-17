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

    $foto    = $stmt->fetchAll();
    $fotoIds = array_column($foto, 'id');

    // Reazioni per foto (in un'unica query per evitare N+1)
    $reazioniPerFoto = []; // foto_id => [ [emoji, count] ]
    $userReazioni    = []; // foto_id => emoji

    if (!empty($fotoIds)) {
        try {
            $ph = implode(',', array_fill(0, count($fotoIds), '?'));

            $stmt = $pdo->prepare(
                "SELECT foto_id, emoji, COUNT(*) AS cnt
                 FROM reazioni WHERE foto_id IN ($ph)
                 GROUP BY foto_id, emoji ORDER BY cnt DESC"
            );
            $stmt->execute($fotoIds);
            foreach ($stmt->fetchAll() as $r) {
                $reazioniPerFoto[(int)$r['foto_id']][] = ['emoji' => $r['emoji'], 'count' => (int)$r['cnt']];
            }

            if ($utenteId !== null) {
                $stmt = $pdo->prepare(
                    "SELECT foto_id, emoji FROM reazioni WHERE utente_id = ? AND foto_id IN ($ph)"
                );
                $stmt->execute(array_merge([$utenteId], $fotoIds));
                foreach ($stmt->fetchAll() as $r) {
                    $userReazioni[(int)$r['foto_id']] = $r['emoji'];
                }
            }
        } catch (Exception $e) {
            // Tabella reazioni non ancora creata — reazioni vuote
        }
    }

    $result = array_map(function ($item) use ($reazioniPerFoto, $userReazioni) {
        $fotoId    = (int)$item['id'];
        $userEmoji = $userReazioni[$fotoId] ?? null;
        $reazioni  = array_map(fn($r) => [
            'emoji'        => $r['emoji'],
            'count'        => $r['count'],
            'user_reacted' => $r['emoji'] === $userEmoji,
        ], $reazioniPerFoto[$fotoId] ?? []);

        return [
            'id'         => $fotoId,
            'percorso'   => $item['percorso'],
            'tipo'       => $item['tipo_file'],
            'username'   => $item['username'],
            'data'       => $item['created_at'],
            'like'       => (int)$item['total_like'],
            'user_liked' => (bool)$item['user_liked'],
            'reazioni'   => $reazioni,
        ];
    }, $foto);

    jsonResponse(['successo' => true, 'foto' => $result]);

} catch (Exception $e) {
    error_log("Errore recupero foto: " . $e->getMessage());
    jsonResponse(['errore' => 'Errore lettura foto'], 500);
}