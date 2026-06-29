# CLAUDE.md

Ce fichier guide Claude Code lors du travail sur ce projet.

## Vue d'ensemble du projet

Bot WhatsApp pour le restaurant "Dar Dzayer" (Oran, Algérie). Le bot doit :
1. Répondre automatiquement aux questions fréquentes (horaires, menu, livraison)
2. Gérer les réservations de table de façon fiable (sans double réservation)
3. Détecter les demandes complexes et alerter le gérant
4. Donner accès à un dashboard simple pour visualiser réservations et messages en attente

Le gérant n'a pas de budget pour des abonnements mensuels coûteux : la
solution doit être codée sur mesure, livrée comme un outil autonome, sans
dépendance à une plateforme tierce payante.

## Fichier de données client

Toutes les informations métier (horaires, menu, livraison, tables,
politique de réservation, mots-clés FAQ) sont centralisées dans
`/config/restaurant.json`. Ce fichier est la SEULE source de vérité pour
les données du restaurant — ne jamais hardcoder ces infos ailleurs dans le code.

## Contraintes importantes (à respecter strictement)

- **Pas d'abonnement à une plateforme tierce payante** (Zapier, Make, Twilio
  payant, etc.). Le bot doit tourner de façon autonome.
- **whatsapp-web.js** est utilisé pour la connexion WhatsApp (gratuit, via
  QR code) — pas l'API officielle Meta pour ce projet.
- **Zéro double réservation.** Toujours vérifier la disponibilité réelle d'une
  table (capacité suffisante + créneau libre, en tenant compte de
  `duree_occupation_table_minutes`) avant de confirmer.
- **Stockage local uniquement** : SQLite (better-sqlite3), pas de base de
  données distante, pas de cloud payant.
- **Toujours transférer au gérant** pour : événements spéciaux (mariage,
  anniversaire, privatisation), réclamations, et toute demande hors-FAQ.
- **Notifications au gérant** via WhatsApp directement (pas d'email).

## Stack technique

- **Runtime** : Node.js
- **WhatsApp** : whatsapp-web.js + qrcode-terminal
- **Base de données** : SQLite via better-sqlite3
- **Dashboard** : Express + EJS
- **IA pour cas ambigus** : API Anthropic (Claude), clé dans `.env`
- **Process manager** : pm2
- **Cron** : node-cron pour le récap quotidien au gérant

## Structure du projet

```
/config
  restaurant.json           → données métier (source de vérité unique)
/db
  init.js                   → création des tables SQLite
  dar-dzayer.db             → base de données (généré, ne pas commit)
/handlers
  messageHandler.js         → routeur principal des messages entrants
/services
  faqService.js             → recherche par mots-clés
  reservationService.js     → logique réservation + anti-double-booking
  aiService.js              → appel API Claude pour cas ambigus
  notificationService.js    → alertes WhatsApp au gérant
/dashboard
  server.js                 → serveur Express
  /views                    → pages du dashboard
/logs                       → logs de conversation (fichiers texte)
index.js                    → point d'entrée, init client WhatsApp
.env.example                → template des variables d'environnement
```

## Logique métier essentielle

### Flow de traitement d'un message entrant
1. Premier contact → message de bienvenue
2. Recherche mots-clés FAQ → réponse directe si match
3. Intention "réservation" → flow de réservation (état par numéro de téléphone)
4. Intention "événement spécial" → transfert direct au gérant
5. Aucun match → tentative API Claude → si confiance insuffisante → transfert gérant

### Flow de réservation
Collecter dans l'ordre : date → heure → nombre de personnes → nom.
Puis :
1. Filtrer tables avec `capacite >= nombre_personnes`
2. Vérifier absence de chevauchement de créneau (+ `duree_occupation_table_minutes`)
3. Table dispo → assigner + confirmer au client
4. Aucune table → proposer créneau le plus proche ou transférer au gérant

## Conventions de code

- JavaScript (Node.js), pas de TypeScript
- Un service = une responsabilité claire
- Variables métier en français autorisées (ex: `nombrePersonnes`), code structurel en anglais
- Logger les erreurs et conversations transférées dans `/logs`

## Ce qu'il NE FAUT PAS faire

- Hardcoder horaires/prix/tables dans le code
- Utiliser une plateforme tierce payante
- Confirmer une réservation sans vérifier la disponibilité réelle
- Laisser l'IA traiter les événements spéciaux — transfert systématique
- Committer `.env` ou le fichier `.db`

## Workflow de développement

1. Setup + connexion WhatsApp (QR code) ← étape actuelle
2. FAQ simple (mots-clés)
3. Système de réservation + anti-double-booking
4. Détection cas complexes + alerte gérant
5. Couche IA (Claude) pour réduire les transferts inutiles
6. Dashboard de gestion
7. Notification quotidienne automatique (cron)
8. Tests bout en bout
9. Déploiement avec pm2
