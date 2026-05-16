-- Database Schema - Compleanno Amore
-- Creazione database e tabelle con relazioni e vincoli

CREATE DATABASE IF NOT EXISTS compleanno_amore;
USE compleanno_amore;

-- ============================================================================
-- TABELLA UTENTI
-- ============================================================================
CREATE TABLE IF NOT EXISTS utenti (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELLA FOTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS foto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    utente_id INT NOT NULL,
    nome_file VARCHAR(255) NOT NULL,
    percorso VARCHAR(500) NOT NULL,
    tipo_file VARCHAR(50) NOT NULL,
    dimensione INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utente_id) REFERENCES utenti(id) ON DELETE CASCADE,
    INDEX idx_utente (utente_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELLA LIKE
-- ============================================================================
CREATE TABLE IF NOT EXISTS like_foto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    foto_id INT NOT NULL,
    utente_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_foto_utente (foto_id, utente_id),
    FOREIGN KEY (foto_id) REFERENCES foto(id) ON DELETE CASCADE,
    FOREIGN KEY (utente_id) REFERENCES utenti(id) ON DELETE CASCADE,
    INDEX idx_foto (foto_id),
    INDEX idx_utente (utente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DATI DI TEST (opzionale)
-- ============================================================================
-- INSERT INTO utenti (username) VALUES ('Celeste');
-- INSERT INTO utenti (username) VALUES ('Andrea');
