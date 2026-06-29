const config = require('../config/restaurant.json');

const JOURS_FR = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ');
}

function detecterIntention(texte) {
  const t = normaliser(texte);
  for (const [intention, mots] of Object.entries(config.mots_cles_faq)) {
    if (mots.some((mot) => t.includes(normaliser(mot)))) return intention;
  }
  return null;
}

function repondreHoraires() {
  const lignes = [`🕐 *Horaires de ${config.nom} :*\n`];
  for (const [jour, horaire] of Object.entries(config.horaires)) {
    lignes.push(`${JOURS_FR[jour]} : ${horaire}`);
  }
  lignes.push(`\n📍 ${config.adresse}`);
  return lignes.join('\n');
}

function repondreMenu() {
  const lignes = [`🍽️ *Carte de ${config.nom} :*\n`];
  for (const item of config.menu) {
    lignes.push(`• ${item.plat} — *${item.prix_dzd} DA*`);
    if (item.disponible !== 'tous les jours') {
      lignes.push(`  _(${item.disponible})_`);
    }
  }
  const mg = config.menu_groupe;
  lignes.push(
    `\n👥 *Menu groupe* (8 pers. min.) : *${mg.prix_par_personne_dzd} DA/pers.*`,
    `📝 ${mg.contenu}`,
    `Sur réservation 24h à l'avance.`
  );
  return lignes.join('\n');
}

function repondreLivraison() {
  const liv = config.livraison;
  if (!liv.disponible) return '❌ La livraison n\'est pas disponible pour le moment.';

  const lignes = [
    '🛵 *Livraison disponible !*\n',
    `Commande minimum : *${liv.minimum_commande_dzd} DA*\n`,
  ];
  for (const zone of liv.zones) {
    if (zone.frais_dzd) {
      lignes.push(`📍 ${zone.zone} : ${zone.frais_dzd} DA — ⏱️ ~${zone.delai_min} min`);
    } else {
      lignes.push(`📍 ${zone.zone} : ${zone.note}`);
    }
  }
  return lignes.join('\n');
}

function detectFAQ(texte) {
  switch (detecterIntention(texte)) {
    case 'horaires':  return repondreHoraires();
    case 'menu':      return repondreMenu();
    case 'livraison': return repondreLivraison();
    default:          return null;
  }
}

module.exports = { detectFAQ, detecterIntention };
