<?php
require 'db.php';

if($_FILES['file']) {
    $nome = $_FILES['file']['name'];
    $tmp = $_FILES['file']['tmp_name'];
    $percorso = 'uploads/'. $nome;

    move_uploaded_file($tmp, $percorso);

    $stmt = $pdo->prepare("INSERT INTO files (nome, percorso) VALUES (?,?)");
    $stmt->execute([$nome, $percorso]);

    echo json_encode(['path' => $percorso]);
}