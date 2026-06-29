require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const { getDB, initDB } = require('../db/init');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

initDB();

app.use(express.urlencoded({ extended: true }));

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── CSS partagé ───────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f4f0; color: #1a1a1a; }
  header { background: #1c1c1c; color: #fff; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 60px; position: sticky; top: 0; }
  header h1 { font-size: 18px; font-weight: 700; }
  header span { font-size: 12px; color: #c8a96e; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  nav { background: #fff; border-bottom: 1px solid #e8e4de; padding: 0 24px; display: flex; gap: 4px; }
  nav a { display: inline-block; padding: 14px 18px; font-size: 14px; font-weight: 500; color: #666; text-decoration: none; border-bottom: 2px solid transparent; }
  nav a:hover { color: #1a1a1a; }
  nav a.active { color: #c8a96e; border-bottom-color: #c8a96e; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
  h2 { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat { background: #fff; border-radius: 10px; border: 1px solid #e8e4de; padding: 20px 24px; }
  .stat .num { font-size: 36px; font-weight: 800; line-height: 1; }
  .stat .label { font-size: 13px; color: #888; margin-top: 6px; }
  .stat.accent .num { color: #c8a96e; }
  .stat.alert .num { color: #e05a3a; }
  .card { background: #fff; border-radius: 10px; border: 1px solid #e8e4de; padding: 20px 24px; margin-bottom: 20px; }
  .card-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #999; border-bottom: 1px solid #f0ede8; }
  td { padding: 12px; border-bottom: 1px solid #f5f4f0; color: #333; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #faf9f7; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #e6f4ea; color: #2d7a3a; }
  .badge-red { background: #fdecea; color: #c0392b; }
  .badge-gray { background: #f0f0f0; color: #666; }
  .badge-orange { background: #fff3e0; color: #e07b1a; }
  .btn { display: inline-block; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
  .btn-primary { background: #c8a96e; color: #fff; }
  .btn-danger { background: #fdecea; color: #c0392b; }
  .empty { text-align: center; padding: 40px; color: #aaa; font-size: 15px; }
  .date-picker { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .date-picker input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; }
  .tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; background: #f0ede8; color: #555; }
  a.link { color: #c8a96e; font-size: 13px; text-decoration: none; }
  @media (max-width: 640px) { main { padding: 16px 12px; } .stats { grid-template-columns: repeat(2,1fr); } td,th { padding: 8px 6px; font-size:13px; } }
`;

function html(page, title, content) {
  const nav = ['home','reservations','messages'];
  const labels = { home: 'Accueil', reservations: 'Réservations', messages: 'Messages' };
  const hrefs  = { home: '/', reservations: '/reservations', messages: '/messages' };
  const navHtml = nav.map(p =>
    `<a href="${hrefs[p]}" class="${p === page ? 'active' : ''}">${labels[p]}</a>`
  ).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dar Dzayer — ${title}</title><style>${CSS}</style></head><body>
<header><h1>🍽️ Dar Dzayer</h1><span>Dashboard</span></header>
<nav>${navHtml}</nav>
<main>${content}</main>
</body></html>`;
}

// ── Accueil ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const db = getDB();
  const date = today();

  const resaAVenir = db.prepare(
    `SELECT * FROM reservations WHERE date_reservation >= ? AND statut = 'confirmee' ORDER BY date_reservation, heure_debut`
  ).all(date);

  const msgEnAttente = db.prepare(
    `SELECT * FROM messages_a_traiter WHERE statut = 'en_attente' ORDER BY created_at DESC LIMIT 5`
  ).all();

  const nbMsgEnAttente = db.prepare(
    `SELECT COUNT(*) as c FROM messages_a_traiter WHERE statut = 'en_attente'`
  ).get().c;

  const nbAujourdhui = db.prepare(
    `SELECT COUNT(*) as c FROM reservations WHERE date_reservation = ? AND statut = 'confirmee'`
  ).get(date).c;

  const totalResa = db.prepare(`SELECT COUNT(*) as c FROM reservations`).get().c;

  const resaRows = resaAVenir.map(r => {
    const isToday = r.date_reservation === date;
    const dateLabel = isToday ? 'Aujourd\'hui' : new Date(r.date_reservation + 'T12:00:00').toLocaleDateString('fr-DZ', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<tr>
      <td style="color:#aaa">#${r.id}</td>
      <td><strong>${r.client_nom}</strong><br><span style="color:#aaa;font-size:12px">${r.client_telephone.replace('@c.us','')}</span></td>
      <td><span style="font-size:12px;color:${isToday ? '#c8a96e' : '#888'};font-weight:600">${dateLabel}</span></td>
      <td>${r.heure_debut}</td>
      <td>${r.nombre_personnes}</td>
      <td><span class="badge badge-green">${r.table_id}</span></td>
    </tr>`;
  }).join('');

  const resaTable = resaAVenir.length === 0
    ? '<p class="empty">Aucune réservation à venir</p>'
    : `<table><thead><tr><th>#</th><th>Client</th><th>Date</th><th>Heure</th><th>Pers.</th><th>Table</th></tr></thead><tbody>${resaRows}</tbody></table>`;

  const msgRows = msgEnAttente.map(m => `
    <tr>
      <td style="white-space:nowrap">${m.telephone.replace('@c.us','')}</td>
      <td>${m.message}</td>
      <td><span class="tag">${m.raison}</span></td>
      <td style="color:#aaa;font-size:12px;white-space:nowrap">${new Date(m.created_at).toLocaleString('fr-DZ')}</td>
    </tr>`).join('');

  const msgTable = msgEnAttente.length === 0
    ? '<p class="empty">Aucun message en attente ✅</p>'
    : `<table><thead><tr><th>Client</th><th>Message</th><th>Type</th><th>Date</th></tr></thead><tbody>${msgRows}</tbody></table>
       <div style="margin-top:12px"><a href="/messages" class="link">Gérer les messages →</a></div>`;

  const dateLabel = new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' });

  const content = `
    <h2>Bonjour 👋 — ${dateLabel}</h2>
    <div class="stats">
      <div class="stat accent"><div class="num">${nbAujourdhui}</div><div class="label">Réservations aujourd'hui</div></div>
      <div class="stat"><div class="num">${resaAVenir.length}</div><div class="label">Réservations à venir</div></div>
      <div class="stat ${nbMsgEnAttente > 0 ? 'alert' : ''}"><div class="num">${nbMsgEnAttente}</div><div class="label">Messages en attente</div></div>
      <div class="stat"><div class="num">${totalResa}</div><div class="label">Total réservations</div></div>
    </div>
    <div class="card"><div class="card-title">📅 Réservations à venir</div>${resaTable}</div>
    <div class="card"><div class="card-title">💬 Messages en attente</div>${msgTable}</div>`;

  res.send(html('home', 'Dashboard', content));
});

// ── Réservations ──────────────────────────────────────────────────────────────

app.get('/reservations', (req, res) => {
  const db = getDB();
  const date = req.query.date || null;

  const reservations = date
    ? db.prepare(`SELECT * FROM reservations WHERE date_reservation = ? ORDER BY heure_debut`).all(date)
    : db.prepare(`SELECT * FROM reservations ORDER BY date_reservation, heure_debut`).all();

  const dateLabel = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Toutes les réservations';

  const rows = reservations.map(r => {
    const badge = r.statut === 'confirmee'
      ? '<span class="badge badge-green">Confirmée</span>'
      : r.statut === 'annulee'
        ? '<span class="badge badge-red">Annulée</span>'
        : `<span class="badge badge-gray">${r.statut}</span>`;
    const btn = r.statut === 'confirmee'
      ? `<form method="POST" action="/reservations/${r.id}/annuler" style="display:inline" onsubmit="return confirm('Annuler ?')">
           <button class="btn btn-danger">Annuler</button></form>`
      : '—';
    const dl = new Date(r.date_reservation + 'T12:00:00').toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' });
    return `<tr>
      <td style="color:#aaa">#${r.id}</td>
      <td><strong>${r.client_nom}</strong></td>
      <td>${r.client_telephone.replace('@c.us','')}</td>
      <td style="white-space:nowrap">${dl}</td>
      <td>${r.heure_debut} – ${r.heure_fin}</td>
      <td>${r.nombre_personnes}</td>
      <td><span class="badge badge-green">${r.table_id}</span></td>
      <td>${badge}</td>
      <td>${btn}</td>
    </tr>`;
  }).join('');

  const table = reservations.length === 0
    ? '<p class="empty">Aucune réservation</p>'
    : `<table><thead><tr><th>#</th><th>Client</th><th>Téléphone</th><th>Date</th><th>Heure</th><th>Pers.</th><th>Table</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;

  const content = `
    <h2>📅 Réservations</h2>
    <form class="date-picker" method="GET" action="/reservations">
      <input type="date" name="date" value="${date || ''}" />
      <button type="submit" class="btn btn-primary">Filtrer</button>
      ${date ? '<a href="/reservations" class="btn" style="background:#f0ede8;color:#555">Tout afficher</a>' : ''}
    </form>
    <div class="card"><div class="card-title">${reservations.length} réservation(s) — ${dateLabel}</div>${table}</div>`;

  res.send(html('reservations', 'Réservations', content));
});

app.post('/reservations/:id/annuler', (req, res) => {
  getDB().prepare(`UPDATE reservations SET statut = 'annulee' WHERE id = ?`).run(req.params.id);
  res.redirect('/reservations');
});

// ── Messages ──────────────────────────────────────────────────────────────────

app.get('/messages', (req, res) => {
  const messages = getDB().prepare(
    `SELECT * FROM messages_a_traiter ORDER BY created_at DESC LIMIT 100`
  ).all();

  const enAttente = messages.filter(m => m.statut === 'en_attente');
  const traites   = messages.filter(m => m.statut !== 'en_attente');

  const rowsEnAttente = enAttente.map(m => `
    <tr>
      <td style="color:#aaa">#${m.id}</td>
      <td style="white-space:nowrap">${m.telephone.replace('@c.us','')}</td>
      <td>${m.message}</td>
      <td><span class="tag">${m.raison}</span></td>
      <td style="color:#aaa;font-size:12px;white-space:nowrap">${new Date(m.created_at).toLocaleString('fr-DZ')}</td>
      <td>
        <form method="POST" action="/messages/${m.id}/traiter">
          <button class="btn btn-primary">Marquer traité</button>
        </form>
      </td>
    </tr>`).join('');

  const tableEnAttente = enAttente.length === 0
    ? '<p class="empty">Aucun message en attente ✅</p>'
    : `<table><thead><tr><th>#</th><th>Téléphone</th><th>Message</th><th>Type</th><th>Date</th><th>Action</th></tr></thead><tbody>${rowsEnAttente}</tbody></table>`;

  const rowsTraites = traites.map(m => `
    <tr style="opacity:0.5">
      <td style="color:#aaa">#${m.id}</td>
      <td>${m.telephone.replace('@c.us','')}</td>
      <td>${m.message}</td>
      <td><span class="tag">${m.raison}</span></td>
      <td style="color:#aaa;font-size:12px">${new Date(m.created_at).toLocaleString('fr-DZ')}</td>
    </tr>`).join('');

  const tableTraites = traites.length === 0 ? '' : `
    <div class="card">
      <div class="card-title">✅ Traités (${traites.length})</div>
      <table><thead><tr><th>#</th><th>Téléphone</th><th>Message</th><th>Type</th><th>Date</th></tr></thead><tbody>${rowsTraites}</tbody></table>
    </div>`;

  const content = `
    <h2>💬 Messages clients</h2>
    <div class="card"><div class="card-title">🔴 En attente (${enAttente.length})</div>${tableEnAttente}</div>
    ${tableTraites}`;

  res.send(html('messages', 'Messages', content));
});

app.post('/messages/:id/traiter', (req, res) => {
  getDB().prepare(`UPDATE messages_a_traiter SET statut = 'traite' WHERE id = ?`).run(req.params.id);
  res.redirect('/messages');
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🖥️  Dashboard : http://localhost:${PORT}`);
});

module.exports = app;
