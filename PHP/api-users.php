<?php
/**
 * API Gestione Utenti
 * Registrazione utenti, recupero dati, salvataggio in database
 */

require_once 'config.php';

$action = $_GET['action'] ?? null;

if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleRegister();
} elseif ($action === 'get' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    handleGetUser();
} else {
    jsonResponse(['errore' => 'Azione non valida'], 400);
}

function handleRegister() {
    $input    = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? null;

    if (empty($username)) {
        jsonResponse(['errore' => 'Username non fornito'], 400);
    }

    $username = trim($username);

    if (strlen($username) < 2) {
        jsonResponse(['errore' => 'Username minimo 2 caratteri'], 400);
    }

    // Permette lettere (incluse accentate), numeri, underscore e spazi
    $username = preg_replace('/[^\p{L}0-9_ ]/u', '', $username);

    if (empty($username)) {
        jsonResponse(['errore' => 'Username contiene caratteri non validi'], 400);
    }

    try {
        $pdo = getDBConnection();

        $stmt = $pdo->prepare('SELECT id, username FROM utenti WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user) {
            jsonResponse([
                'successo' => true,
                'id'       => (int)$user['id'],
                'username' => $user['username'],
                'nuovo'    => false
            ]);
        }

        $stmt = $pdo->prepare('INSERT INTO utenti (username) VALUES (?)');
        $stmt->execute([$username]);
        $userId = (int)$pdo->lastInsertId();

        jsonResponse([
            'successo' => true,
            'id'       => $userId,
            'username' => $username,
            'nuovo'    => true
        ]);

    } catch (Exception $e) {
        error_log('Errore registrazione: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}

function handleGetUser() {
    $userId = $_GET['id'] ?? null;

    if (empty($userId) || !is_numeric($userId)) {
        jsonResponse(['errore' => 'ID utente non valido'], 400);
    }

    try {
        $pdo  = getDBConnection();
        $stmt = $pdo->prepare('SELECT id, username, created_at FROM utenti WHERE id = ?');
        $stmt->execute([(int)$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(['errore' => 'Utente non trovato'], 404);
        }

        jsonResponse([
            'successo' => true,
            'utente'   => [
                'id'         => (int)$user['id'],
                'username'   => $user['username'],
                'created_at' => $user['created_at']
            ]
        ]);

    } catch (Exception $e) {
        error_log('Errore recupero utente: ' . $e->getMessage());
        jsonResponse(['errore' => 'Errore database'], 500);
    }
}