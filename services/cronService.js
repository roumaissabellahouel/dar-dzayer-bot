const cron = require('node-cron');
const { getDB } = require('../db/init');
const { alerterGerant } = require('./notificationService');

function demain() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

async function envoyerRecapQuotidien(client) {
  const db = getDB();
  const dateDemain = demain();

  const reservations = db.prepare(`
    SELECT * FROM reservations
    WHERE date_reservation = ? AND statut = 'confirmee'
    ORDER BY heure_debut
  `).all(dateDemain);

  const nbMessagesEnAttente = db.prepare(`
    SELECT COUNT(*) as c FROM messages_a_traiter WHERE statut = 'en_attente'
  `).get().c;

  const dateLabel = new Date(dateDemain + 'T12:00:00').toLocaleDateString('fr-DZ', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  let message = `📊 *Récap du soir — Dar Dzayer*\n\n`;

  if (reservations.length === 0) {
    message += `📅 Aucune réservation pour demain (${dateLabel}).\n`;
  } else {
    message += `📅 *${reservations.length} réservation(s) pour demain (${dateLabel}) :*\n`;
    reservations.forEach(r => {
      message += `• ${r.heure_debut} — ${r.client_nom} (${r.nombre_personnes} pers.) — Table ${r.table_id}\n`;
    });
  }

  message += `\n💬 Messages en attente : *${nbMessagesEnAttente}*\n`;
  message += `🖥️ Dashboard : http://localhost:3001\n\n`;
  message += `Bonne soirée ! 🌙`;

  await alerterGerant(client, message);
  console.log('📊 Récap quotidien envoyé au gérant.');
}

function demarrerCron(client) {
  // Envoi tous les jours à 20h00
  cron.schedule('0 20 * * *', () => {
    envoyerRecapQuotidien(client).catch(err =>
      console.error('Erreur récap quotidien :', err.message)
    );
  }, { timezone: 'Africa/Algiers' });

  console.log('⏰ Récap quotidien programmé à 20h00 (heure d\'Alger).');
}

module.exports = { demarrerCron, envoyerRecapQuotidien };
