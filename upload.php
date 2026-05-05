<?php
if (!isset($_FILES["foto"])) {
    echo "Nessun file ricevuto";
    exit;
}

$uploadDir = __DIR__ . "/uploads/";
$salvati = 0;

foreach ($_FILES["foto"]["name"] as $i => $nome) {
    if ($_FILES["foto"]["error"][$i] !== 0) continue;

    $tmpFile = $_FILES["foto"]["tmp_name"][$i];
    $nomeFile = uniqid() . ".jpg";
    $destinazione = $uploadDir . $nomeFile;

    if (move_uploaded_file($tmpFile, $destinazione)) {
        $salvati++;
    }
}

echo "Salvate $salvati immagini";
?>