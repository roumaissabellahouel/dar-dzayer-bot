const config = require('../config/restaurant.json');
const { detectFAQ, detecterIntention } = require('../services/faqService');
const { getSession, setSession, clearSession } = require('../services/sessionService');
const {
  getHorairesDuJour,
  estHoraireValide,
  verifierDisponibilite,
  trouverProchainCreneau,
  calculerHeureFin,
  creerReservation,
} = require('../services/reservationService');
const {
  alerterGerant,
  notifierReservation,
  notifierReclamation,
  notifierEvenement,
  loggerMessageInconnu,
} = require('../services/notificationService');
const { interrogerClaude } = require('../services/aiService');

const premiersContacts = new Set();

// ── Utilitaires date / heure ──────────────────────────────────────────────────

const JOURS_KEYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function parseDate(texte) {
  const t = texte.toLowerCase().trim();
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);

  if (['aujourd\'hui', 'aujd', 'aujourdhui'].includes(t)) return new Date(auj);

  if (t === 'demain') {
    const d = new Date(auj);
    d.setDate(d.getDate() + 1);
    return d;
  }

  for (let i = 0; i < JOURS_KEYS.length; i++) {
    if (t.includes(JOURS_KEYS[i])) {
      const diff = ((i - auj.getDay()) + 7) % 7 || 7;
      const d = new Date(auj);
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const d = new Date(m[3] ? +m[3] : auj.getFullYear(), +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function formatDateStr(date) {
  return date.toISOString().split('T')[0];
}

function formatDateFr(date) {
  const j = date.getDate().toString().padStart(2, '0');
  const mo = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${JOURS_FR[date.getDay()]} ${j}/${mo}/${date.getFullYear()}`;
}

function parseHeure(texte) {
  const t = texte.trim().toLowerCase().replace(/h/g, ':').replace(/::+/g, ':').replace(/:$/, '');
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = +m[1], mn = +(m[2] || 0);
  if (h > 23 || mn > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

function afficherPlages(plages) {
  return plages.map((p) => `${p.debut} – ${p.fin}`).join(' et ');
}

// ── Étapes du flow de réservation ────────────────────────────────────────────

async function demarrerReservation(telephone, client) {
  setSession(telephone, { etape: 'attente_date' });
  await client.sendMessage(
    telephone,
    '📅 Pour quelle date souhaitez-vous réserver ?\n_(ex : demain, vendredi, 05/07)_'
  );
}

async function traiterDate(telephone, texte, client) {
  const date = parseDate(texte);
  if (!date) {
    return client.sendMessage(telephone, '❌ Date non reconnue. Essayez : "demain", "vendredi" ou "05/07".');
  }
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  if (date < auj) {
    return client.sendMessage(telephone, '❌ Cette date est déjà passée. Choisissez une date à partir d\'aujourd\'hui.');
  }
  const plages = getHorairesDuJour(date);
  if (!plages) {
    return client.sendMessage(telephone, `😔 Nous sommes fermés le *${JOURS_FR[date.getDay()]}*. Choisissez un autre jour.`);
  }
  setSession(telephone, { etape: 'attente_heure', dateObj: date, dateStr: formatDateStr(date), plages });
  await client.sendMessage(
    telephone,
    `📅 *${formatDateFr(date)}* — noté !\n\n` +
    `⏰ À quelle heure souhaitez-vous venir ?\n` +
    `Nous sommes ouverts : *${afficherPlages(plages)}*\n_(ex : 19h30, 12:00)_`
  );
}

async function traiterHeure(telephone, texte, session, client) {
  const heure = parseHeure(texte);
  if (!heure) {
    return client.sendMessage(telephone, '❌ Format non reconnu. Essayez "19h30" ou "12:00".');
  }
  if (!estHoraireValide(heure, session.plages)) {
    return client.sendMessage(
      telephone,
      `❌ *${heure}* est en dehors de nos horaires.\n` +
      `Horaires du jour : *${afficherPlages(session.plages)}*\n_(La table doit être libérée avant la fermeture)_`
    );
  }
  setSession(telephone, { ...session, etape: 'attente_personnes', heure });
  await client.sendMessage(telephone, '👥 Pour combien de personnes ?');
}

async function traiterPersonnes(telephone, texte, session, client) {
  const n = parseInt(texte, 10);
  const maxCapacite = Math.max(...config.tables.map((t) => t.capacite));
  if (!n || n < 1) {
    return client.sendMessage(telephone, '❌ Merci d\'entrer un nombre valide (ex : 4).');
  }
  if (n > maxCapacite) {
    return client.sendMessage(
      telephone,
      `😔 Nous ne pouvons pas accueillir plus de *${maxCapacite} personnes* par table.\n` +
      `Pour les grands groupes : *${config.telephone_gerant}*`
    );
  }
  setSession(telephone, { ...session, etape: 'attente_nom', nombrePersonnes: n });
  await client.sendMessage(telephone, '👤 Quel est votre nom complet ?');
}

async function traiterNom(telephone, texte, session, client) {
  const nom = texte.trim();
  if (nom.length < 2) {
    return client.sendMessage(telephone, '❌ Merci d\'entrer votre nom complet.');
  }

  const { disponible, table, heureFin } = verifierDisponibilite(session.dateStr, session.heure, session.nombrePersonnes);

  if (disponible) {
    setSession(telephone, { ...session, etape: 'attente_confirmation', nom, tableId: table.id, heureFin });
    return client.sendMessage(
      telephone,
      `✅ *Récapitulatif de votre réservation :*\n\n` +
      `📅 ${formatDateFr(session.dateObj)}\n` +
      `⏰ ${session.heure}\n` +
      `👥 ${session.nombrePersonnes} personne(s)\n` +
      `👤 ${nom}\n` +
      `📍 ${config.adresse}\n\n` +
      `Confirmez-vous ? *(oui / non)*`
    );
  }

  const prochainCreneau = trouverProchainCreneau(session.dateStr, session.nombrePersonnes, session.plages);
  if (prochainCreneau) {
    setSession(telephone, {
      ...session,
      etape: 'attente_creneau_alternatif',
      nom,
      heure: prochainCreneau,
      heureFin: calculerHeureFin(prochainCreneau),
    });
    return client.sendMessage(
      telephone,
      `😔 Plus de table disponible pour *${session.nombrePersonnes} pers.* à *${session.heure}* le ${formatDateFr(session.dateObj)}.\n\n` +
      `Le prochain créneau disponible est à *${prochainCreneau}*.\n` +
      `Voulez-vous réserver à *${prochainCreneau}* ? *(oui / non)*`
    );
  }

  clearSession(telephone);
  await client.sendMessage(
    telephone,
    `😔 Nous sommes *complets* pour *${session.nombrePersonnes} pers.* le ${formatDateFr(session.dateObj)}.\n\n` +
    `Essayez une autre date ou contactez-nous : 📞 *${config.telephone_gerant}*`
  );
}

async function traiterConfirmation(telephone, texte, session, client) {
  const rep = texte.toLowerCase().trim();
  const OUI = ['oui', 'yes', 'o', 'ok', 'confirme', 'confirmé'];
  const NON = ['non', 'no', 'n', 'annuler', 'annule'];

  if (OUI.includes(rep)) {
    const id = creerReservation({
      dateStr: session.dateStr,
      heureDebut: session.heure,
      heureFin: session.heureFin,
      nombrePersonnes: session.nombrePersonnes,
      nom: session.nom,
      telephone,
      tableId: session.tableId,
    });
    clearSession(telephone);

    await client.sendMessage(
      telephone,
      `✅ *Réservation confirmée !* (réf. #${id})\n\n` +
      `Nous vous attendons le *${formatDateFr(session.dateObj)}* à *${session.heure}*.\n` +
      `📍 ${config.adresse}\n\n` +
      `${config.politique_reservation.annulation}\n📞 *${config.telephone_gerant}* 🙏`
    );

    await notifierReservation(client, {
      id,
      dateFr: formatDateFr(session.dateObj),
      heure: session.heure,
      nombrePersonnes: session.nombrePersonnes,
      nom: session.nom,
      telephone,
      tableId: session.tableId,
    });
    return;
  }

  if (NON.includes(rep)) {
    clearSession(telephone);
    return client.sendMessage(telephone, '❌ Réservation annulée. N\'hésitez pas à recommencer ! 😊');
  }

  await client.sendMessage(telephone, 'Répondez *oui* pour confirmer ou *non* pour annuler.');
}

async function traiterCreneauAlternatif(telephone, texte, session, client) {
  const rep = texte.toLowerCase().trim();
  const OUI = ['oui', 'yes', 'o', 'ok', 'confirme'];

  if (OUI.includes(rep)) {
    const { disponible, table } = verifierDisponibilite(session.dateStr, session.heure, session.nombrePersonnes);
    if (!disponible) {
      clearSession(telephone);
      return client.sendMessage(telephone, `😔 Ce créneau vient d'être pris. Contactez-nous : *${config.telephone_gerant}*`);
    }
    setSession(telephone, { ...session, etape: 'attente_confirmation', tableId: table.id });
    return client.sendMessage(
      telephone,
      `✅ *Récapitulatif :*\n\n` +
      `📅 ${formatDateFr(session.dateObj)}\n` +
      `⏰ ${session.heure}\n` +
      `👥 ${session.nombrePersonnes} pers.\n` +
      `👤 ${session.nom}\n\n` +
      `Confirmez-vous ? *(oui / non)*`
    );
  }

  clearSession(telephone);
  await client.sendMessage(telephone, `D'accord ! Contactez-nous au *${config.telephone_gerant}* ou réessayez avec une autre date. 😊`);
}

// ── Routeur principal ─────────────────────────────────────────────────────────

async function handleMessage(msg, client) {
  const texte    = msg.body.trim();
  const telephone = msg.from;
  const session  = getSession(telephone);

  // Annulation en cours de flow
  if (session && ['annuler', 'annule', 'stop', 'quitter'].includes(texte.toLowerCase())) {
    clearSession(telephone);
    return client.sendMessage(telephone, '❌ Réservation annulée. Je peux vous aider avec autre chose ? 😊');
  }

  // Flow de réservation en cours
  if (session) {
    switch (session.etape) {
      case 'attente_date':               return traiterDate(telephone, texte, client);
      case 'attente_heure':              return traiterHeure(telephone, texte, session, client);
      case 'attente_personnes':          return traiterPersonnes(telephone, texte, session, client);
      case 'attente_nom':                return traiterNom(telephone, texte, session, client);
      case 'attente_confirmation':       return traiterConfirmation(telephone, texte, session, client);
      case 'attente_creneau_alternatif': return traiterCreneauAlternatif(telephone, texte, session, client);
    }
  }

  const intention = detecterIntention(texte);
  // FAQ seulement pour les messages courts (mot-clé simple) — les questions longues vont à Claude
  const estUneQuestion = texte.includes('?') || texte.trim().split(/\s+/).length > 3;
  const reponseFAQ = estUneQuestion ? null : detectFAQ(texte);

  // Premier contact — bienvenue en préfixe si le message n'a pas de sens précis
  if (!premiersContacts.has(telephone)) {
    premiersContacts.add(telephone);
    if (!intention && !reponseFAQ) {
      await client.sendMessage(
        telephone,
        `Bienvenue chez *${config.nom}* ! 🍽️\n\n` +
        `Je suis votre assistant virtuel. Je peux vous renseigner sur :\n\n` +
        `🕐 *Horaires* — tapez "horaires"\n` +
        `🍽️ *Menu & prix* — tapez "menu"\n` +
        `🛵 *Livraison* — tapez "livraison"\n` +
        `📅 *Réservation* — tapez "réserver"\n\n` +
        `Pour toute autre demande : *${config.telephone_gerant}*`
      );
      // pas de return → continue vers Claude pour répondre à la question
    }
  }

  if (intention === 'reservation') return demarrerReservation(telephone, client);

  if (intention === 'evenement') {
    await client.sendMessage(
      telephone,
      `Pour les événements spéciaux (mariage, anniversaire, privatisation),\n` +
      `contactez directement notre gérant :\n📞 *${config.telephone_gerant}*`
    );
    notifierEvenement(client, telephone, texte);
    return;
  }

  if (intention === 'reclamation') {
    await client.sendMessage(
      telephone,
      `Nous sommes vraiment désolés pour cette expérience. 🙏\n\n` +
      `Votre message a été transmis à notre gérant qui vous contactera très bientôt.\n` +
      `Vous pouvez aussi l'appeler directement : 📞 *${config.telephone_gerant}*`
    );
    notifierReclamation(client, telephone, texte);
    return;
  }

  if (reponseFAQ) return client.sendMessage(telephone, reponseFAQ);

  // Aucun mot-clé reconnu → interroger Claude avec le contexte du restaurant
  try {
    const { reponse, transfert } = await interrogerClaude(texte);
    if (!transfert && reponse) {
      return client.sendMessage(telephone, reponse);
    }
  } catch (err) {
    console.error('⚠️  Erreur Claude API:', err.message);
  }

  // Claude a répondu TRANSFERT (ou erreur) → logger + alerter gérant + informer le client
  loggerMessageInconnu(telephone, texte);
  alerterGerant(
    client,
    `❓ *Message hors-FAQ — assistance requise*\n\n` +
    `📞 ${telephone.replace('@c.us', '')}\n` +
    `💬 "${texte}"\n` +
    `⏰ ${new Date().toLocaleString('fr-DZ')}`
  ).catch((err) => console.error('⚠️  alerterGerant:', err.message));

  await client.sendMessage(
    telephone,
    `Je transmets votre message à notre équipe qui vous répondra très bientôt. 🙏\n\n` +
    `Vous pouvez aussi nous appeler directement : 📞 *${config.telephone_gerant}*`
  );
}

module.exports = { handleMessage };
