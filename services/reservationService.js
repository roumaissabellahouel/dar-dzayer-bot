const config = require('../config/restaurant.json');
const { getDB } = require('../db/init');

const DUREE = config.politique_reservation.duree_occupation_table_minutes;

function heureToMinutes(heure) {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHeure(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculerHeureFin(heureDebut) {
  return minutesToHeure(heureToMinutes(heureDebut) + DUREE);
}

function getHorairesDuJour(date) {
  const joursKeys = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const horaire = config.horaires[joursKeys[date.getDay()]];
  if (!horaire || horaire === 'fermé' || horaire === 'ferme') return null;
  return horaire.split(',').map((plage) => {
    const [debut, fin] = plage.trim().split('-');
    return { debut: debut.trim(), fin: fin.trim() };
  });
}

function estHoraireValide(heureDebut, plages) {
  const debutMin = heureToMinutes(heureDebut);
  const finMin = debutMin + DUREE;
  return plages.some(({ debut, fin }) =>
    debutMin >= heureToMinutes(debut) && finMin <= heureToMinutes(fin)
  );
}

function trouverTableDispo(dateStr, heureDebut, heureFin, nombrePersonnes) {
  const db = getDB();
  const occupees = db.prepare(`
    SELECT DISTINCT table_id FROM reservations
    WHERE date_reservation = ?
      AND statut = 'confirmee'
      AND heure_debut < ?
      AND heure_fin > ?
  `).all(dateStr, heureFin, heureDebut).map((r) => r.table_id);

  return config.tables.find((t) =>
    t.capacite >= nombrePersonnes && !occupees.includes(t.id)
  ) || null;
}

function verifierDisponibilite(dateStr, heureDebut, nombrePersonnes) {
  const heureFin = calculerHeureFin(heureDebut);
  const table = trouverTableDispo(dateStr, heureDebut, heureFin, nombrePersonnes);
  return { disponible: !!table, table, heureFin };
}

function trouverProchainCreneau(dateStr, nombrePersonnes, plages) {
  const creneaux = [];
  for (const { debut, fin } of plages) {
    let current = heureToMinutes(debut);
    while (current + DUREE <= heureToMinutes(fin)) {
      creneaux.push(minutesToHeure(current));
      current += 30;
    }
  }
  return creneaux.find((c) => verifierDisponibilite(dateStr, c, nombrePersonnes).disponible) || null;
}

function creerReservation({ dateStr, heureDebut, heureFin, nombrePersonnes, nom, telephone, tableId }) {
  const db = getDB();
  const result = db.prepare(`
    INSERT INTO reservations
      (client_telephone, client_nom, date_reservation, heure_debut, heure_fin, nombre_personnes, table_id, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmee')
  `).run(telephone, nom, dateStr, heureDebut, heureFin, nombrePersonnes, tableId);
  return result.lastInsertRowid;
}

module.exports = {
  getHorairesDuJour,
  estHoraireValide,
  verifierDisponibilite,
  trouverProchainCreneau,
  calculerHeureFin,
  creerReservation,
};
