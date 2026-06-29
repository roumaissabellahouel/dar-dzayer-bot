const assert = require('assert');
const path = require('path');
const Database = require('better-sqlite3');

// Base de données de test en mémoire
const db = new Database(':memory:');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE reservations (
    id               INTEGER  PRIMARY KEY AUTOINCREMENT,
    client_telephone TEXT     NOT NULL,
    client_nom       TEXT     NOT NULL,
    date_reservation TEXT     NOT NULL,
    heure_debut      TEXT     NOT NULL,
    heure_fin        TEXT     NOT NULL,
    nombre_personnes INTEGER  NOT NULL,
    table_id         TEXT     NOT NULL,
    statut           TEXT     NOT NULL DEFAULT 'confirmee',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE messages_a_traiter (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    telephone  TEXT     NOT NULL,
    message    TEXT     NOT NULL,
    raison     TEXT     NOT NULL,
    statut     TEXT     NOT NULL DEFAULT 'en_attente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Injecter la DB de test
const dbInit = require('../db/init');
dbInit.__setDB(db);

const {
  verifierDisponibilite,
  creerReservation,
  getHorairesDuJour,
  estHoraireValide,
} = require('../services/reservationService');

let ok = 0, fail = 0;

function test(nom, fn) {
  try {
    fn();
    console.log(`  ✅ ${nom}`);
    ok++;
  } catch (e) {
    console.log(`  ❌ ${nom} — ${e.message}`);
    fail++;
  }
}

console.log('\n📋 Tests Réservation\n');

// Horaires
test('Lundi est ouvert', () => {
  const lundi = new Date('2026-07-06'); // un lundi
  assert(getHorairesDuJour(lundi) !== null);
});

test('Dimanche est fermé', () => {
  const dim = new Date('2026-07-05'); // un dimanche
  assert(getHorairesDuJour(dim) === null);
});

// Horaire valide
test('19h30 est valide (dans la plage soir)', () => {
  assert(estHoraireValide('19:30', [{ debut: '19:00', fin: '23:00' }]));
});

test('23h00 est invalide (table pas libérée avant fermeture)', () => {
  // 23:00 + 90min = 00:30 > 23:00 → invalide
  assert(!estHoraireValide('23:00', [{ debut: '19:00', fin: '23:00' }]));
});

// Disponibilité
test('Table disponible pour 2 personnes', () => {
  const { disponible } = verifierDisponibilite('2026-07-10', '12:00', 2);
  assert(disponible);
});

test('Table disponible pour 10 personnes', () => {
  const { disponible } = verifierDisponibilite('2026-07-10', '12:00', 10);
  assert(disponible);
});

// Anti-double-booking
test('Anti-double-booking : même créneau refusé', () => {
  // Créer une réservation
  creerReservation({
    dateStr: '2026-07-15',
    heureDebut: '19:00',
    heureFin: '20:30',
    nombrePersonnes: 10,
    nom: 'Test Client',
    telephone: '213550000001@c.us',
    tableId: 'T7',
  });

  // Tenter de réserver la même table T7 au même créneau
  const { disponible, table } = verifierDisponibilite('2026-07-15', '19:00', 10);
  // T7 est la seule table pour 10 personnes → doit être indisponible
  assert(!disponible || (table && table.id !== 'T7'));
});

test('Anti-double-booking : créneau différent accepté', () => {
  const { disponible } = verifierDisponibilite('2026-07-15', '21:00', 10);
  assert(disponible);
});

test('Chevauchement partiel détecté', () => {
  // Créneau 19:00-20:30 déjà pris pour T7
  // Essayer 19:45 (chevauchement avec la résa existante)
  const { disponible, table } = verifierDisponibilite('2026-07-15', '19:45', 10);
  assert(!disponible || (table && table.id !== 'T7'));
});

console.log(`\n  ${ok} passés — ${fail} échoués\n`);
if (fail > 0) process.exit(1);
