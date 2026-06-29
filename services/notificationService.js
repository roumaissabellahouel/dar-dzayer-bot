const fs = require('fs');
const path = require('path');
const config = require('../config/restaurant.json');
const { getDB } = require('../db/init');

const LOG_PATH = path.join(__dirname, '../logs/transferts.log');

function loggerTransfert(telephone, message, raison) {
  const tel = telephone.replace('@c.us', '');
  const line = `[${new Date().toISOString()}] [${raison}] ${tel} | "${message}"\n`;
  fs.appendFileSync(LOG_PATH, line);

  getDB().prepare(`
    INSERT INTO messages_a_traiter (telephone, message, raison)
    VALUES (?, ?, ?)
  `).run(tel, message, raison);
}

async function alerterGerant(client, texte) {
  const tel = config.telephone_gerant.replace('+', '');
  try {
    await client.sendMessage(`${tel}@c.us`, texte);
  } catch (err) {
    console.error('⚠️  Impossible d\'alerter le gérant :', err.message);
  }
}

async function notifierReservation(client, { id, dateStr, dateFr, heure, nombrePersonnes, nom, telephone, tableId }) {
  await alerterGerant(
    client,
    `🔔 *Nouvelle réservation #${id}*\n\n` +
    `📅 ${dateFr} à *${heure}*\n` +
    `👥 ${nombrePersonnes} pers. — 🪑 Table ${tableId}\n` +
    `👤 ${nom}\n` +
    `📞 ${telephone.replace('@c.us', '')}`
  );
}

async function notifierReclamation(client, telephone, message) {
  loggerTransfert(telephone, message, 'reclamation');
  await alerterGerant(
    client,
    `🚨 *Réclamation client*\n\n` +
    `📞 ${telephone.replace('@c.us', '')}\n` +
    `💬 "${message}"\n` +
    `⏰ ${new Date().toLocaleString('fr-DZ')}`
  );
}

async function notifierEvenement(client, telephone, message) {
  loggerTransfert(telephone, message, 'evenement-special');
  await alerterGerant(
    client,
    `🎉 *Demande événement spécial*\n\n` +
    `📞 ${telephone.replace('@c.us', '')}\n` +
    `💬 "${message}"\n` +
    `⏰ ${new Date().toLocaleString('fr-DZ')}`
  );
}

function loggerMessageInconnu(telephone, message) {
  loggerTransfert(telephone, message, 'hors-FAQ');
}

module.exports = {
  alerterGerant,
  notifierReservation,
  notifierReclamation,
  notifierEvenement,
  loggerMessageInconnu,
};
