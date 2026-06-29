const assert = require('assert');
const { detectFAQ, detecterIntention } = require('../services/faqService');

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

console.log('\n📋 Tests FAQ\n');

test('Détecte "horaires"', () => assert(detectFAQ('horaires')));
test('Détecte "menu" avec accent', () => assert(detectFAQ('menu')));
test('Détecte "livraison"', () => assert(detectFAQ('livraison')));
test('Détecte "ouvert" (synonyme horaires)', () => assert(detectFAQ('vous êtes ouverts ?')));
test('Détecte "prix" (synonyme menu)', () => assert(detectFAQ('prix')));
test('Ne détecte rien pour message vide', () => assert(!detectFAQ('')));

console.log('\n📋 Tests Intention\n');

test('Détecte intention réservation', () => assert(detecterIntention('je veux réserver une table') === 'reservation'));
test('Détecte intention événement', () => assert(detecterIntention('je veux organiser un mariage') === 'evenement'));
test('Détecte intention réclamation', () => assert(detecterIntention('j\'ai un problème') === 'reclamation'));
test('Retourne null pour message inconnu', () => assert(detecterIntention('bonjour') === null));

console.log(`\n  ${ok} passés — ${fail} échoués\n`);
if (fail > 0) process.exit(1);
