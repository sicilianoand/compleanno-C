<?php
/**
 * Test Connessione Database
 * Verifica che il database sia stato creato correttamente
 */

require_once 'config.php';

try {
    $pdo = getDBConnection();
    echo "✅ Connessione database OK\n\n";

    // Verifica tabelle
    $tables = ['utenti', 'foto', 'like_foto'];
    foreach ($tables as $table) {
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->fetch()) {
            echo "✅ Tabella '$table' esiste\n";
        } else {
            echo "❌ Tabella '$table' NON esiste\n";
        }
    }

    echo "\n📊 Dati nel database:\n";
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM utenti");
    echo "- Utenti: " . $stmt->fetch()['cnt'] . "\n";

    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM foto");
    echo "- Foto: " . $stmt->fetch()['cnt'] . "\n";

    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM like_foto");
    echo "- Like: " . $stmt->fetch()['cnt'] . "\n";

} catch (Exception $e) {
    echo "❌ ERRORE: " . $e->getMessage() . "\n";
}
?>
