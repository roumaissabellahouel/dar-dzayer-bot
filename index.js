require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./db/init');
const { handleMessage } = require('./handlers/messageHandler');
const { demarrerCron, envoyerRecapQuotidien } = require('./services/cronService');

initDB();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scannez ce QR code avec WhatsApp pour connecter le bot :\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('🔐 Authentification réussie.');
});

client.on('ready', () => {
  console.log('✅ Bot Dar Dzayer connecté et prêt.');
  demarrerCron(client);
});

client.on('message', async (msg) => {
  if (msg.fromMe) return;

  const line = `[${new Date().toISOString()}] DE: ${msg.from} | "${msg.body}"\n`;
  process.stdout.write(line);
  fs.appendFileSync(path.join(__dirname, 'logs', 'messages.log'), line);

  try {
    await handleMessage(msg, client);
  } catch (err) {
    console.error('Erreur handleMessage:', err);
  }
});

client.on('disconnected', (reason) => {
  console.error('❌ Bot déconnecté :', reason);
});

client.initialize();
