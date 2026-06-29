const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'dar-dzayer.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id                INTEGER  PRIMARY KEY AUTOINCREMENT,
      client_telephone  TEXT     NOT NULL,
      client_nom        TEXT     NOT NULL,
      date_reservation  TEXT     NOT NULL,
      heure_debut       TEXT     NOT NULL,
      heure_fin         TEXT     NOT NULL,
      nombre_personnes  INTEGER  NOT NULL,
      table_id          TEXT     NOT NULL,
      statut            TEXT     NOT NULL DEFAULT 'confirmee',
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages_a_traiter (
      id         INTEGER  PRIMARY KEY AUTOINCREMENT,
      telephone  TEXT     NOT NULL,
      message    TEXT     NOT NULL,
      raison     TEXT     NOT NULL,
      statut     TEXT     NOT NULL DEFAULT 'en_attente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('🗄️  Base de données initialisée :', DB_PATH);
}

function __setDB(testDb) { db = testDb; }

module.exports = { initDB, getDB, __setDB };
