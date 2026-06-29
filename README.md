# 🍽️ Dar Dzayer — Bot WhatsApp

Bot WhatsApp intelligent pour le restaurant **Dar Dzayer** (Oran, Algérie).  
Gère automatiquement les réservations, répond aux questions fréquentes et alerte le gérant en temps réel.

---

## ✨ Fonctionnalités

- **FAQ automatique** — répond aux questions sur les horaires, menu, livraison
- **Réservation de table** — flow complet par messages WhatsApp
- **Anti-double-booking** — vérification temps réel des disponibilités
- **Couche IA (Groq / Llama 3.3)** — répond aux questions hors-FAQ en langage naturel (français, arabe, darija)
- **Alertes gérant** — notification WhatsApp immédiate pour réclamations et événements spéciaux
- **Récap quotidien** — résumé automatique envoyé au gérant chaque soir à 20h
- **Dashboard web** — interface admin pour voir réservations et messages en attente

---

## 🛠️ Stack technique

| Couche | Technologie |
|--------|------------|
| WhatsApp | whatsapp-web.js |
| Base de données | SQLite (better-sqlite3) |
| IA | Groq API (Llama 3.3 70B + Whisper) |
| Dashboard | Express.js |
| Process manager | pm2 |

---

## 🏗️ Architecture

```
/config
  restaurant.json        → Source de vérité unique (horaires, menu, tables...)
/db
  init.js                → Initialisation SQLite
/handlers
  messageHandler.js      → Routeur principal des messages WhatsApp
/services
  faqService.js          → Détection mots-clés FAQ
  reservationService.js  → Logique réservation + anti-double-booking
  aiService.js           → Appel Groq API pour messages hors-FAQ
  notificationService.js → Alertes WhatsApp au gérant
  sessionService.js      → Gestion état conversationnel (par numéro)
  cronService.js         → Récap quotidien automatique
/dashboard
  server.js              → Serveur Express
/tests
  test-faq.js            → Tests unitaires FAQ
  test-reservation.js    → Tests unitaires réservation + anti-double-booking
```

---

## 🔄 Flow de traitement d'un message

```
Message WhatsApp reçu
        ↓
Réservation en cours ? → Continuer le flow (date → heure → pers. → nom → confirmation)
        ↓
Intention détectée ? (réservation / événement / réclamation) → Réponse dédiée
        ↓
Mot-clé FAQ ? (horaires / menu / livraison) → Réponse directe
        ↓
Groq Llama 3.3 → Réponse contextualisée avec les données du restaurant
        ↓
TRANSFERT → Log en base + alerte WhatsApp au gérant
```

---

## ⚙️ Installation

```bash
git clone https://github.com/ton-user/dar-dzayer-bot
cd dar-dzayer-bot
npm install
cp .env.example .env
# Ajouter GROQ_API_KEY dans .env
node index.js
# Scanner le QR code avec WhatsApp
```

### Variables d'environnement

```env
GROQ_API_KEY=your_groq_api_key
DASHBOARD_PORT=3001       # optionnel
```

---

## 🧪 Tests

```bash
node tests/test-all.js
```

```
📋 Tests FAQ        — 10/10 ✅
📋 Tests Réservation — 9/9  ✅
TOTAL : 19 ✅  0 ❌
```

---

## 📊 Dashboard

Accessible sur `http://localhost:3001`

- Vue d'ensemble : réservations à venir + messages en attente
- Page réservations : toutes les réservations avec filtre par date + annulation
- Page messages : messages transférés au gérant avec statut traité/en attente

---

## 🇩🇿 Spécificités Algérie

- Paiement Cash On Delivery uniquement
- Support français, arabe et darija (vocal + texte)
- Zones de livraison et frais définis par wilaya
- Fuseau horaire Africa/Algiers pour le récap quotidien
