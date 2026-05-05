<?php
$uploadDir = __DIR__ . "/uploads/";
$files = glob($uploadDir . "*.jpg");

$immagini = [];
foreach ($files as $file) {
    $immagini[] = "uploads/" . basename($file);
}

header("Content-Type: application/json");
echo json_encode($immagini);
?>