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

Un exemple complet et réaliste de ce fichier est fourni pour le développement 
et les tests (voir `/config/restaurant.json`).

## Contraintes importantes (à respecter strictement)

- **Pas d'abonnement à une plateforme tierce payante** (Zapier, Make, Twilio 
  payant, etc.). Le bot doit tourner de façon autonome.
- **whatsapp-web.js** est utilisé pour la connexion WhatsApp (gratuit, via 
  QR code) — pas l'API officielle Meta pour ce projet (trop lourd à mettre 
  en place pour ce budget/cas d'usage).
- **Zéro double réservation.** C'est la fonctionnalité la plus critique du 
  projet : toujours vérifier la disponibilité réelle d'une table (capacité 
  suffisante + créneau libre, en tenant compte de `duree_occupation_table_minutes`) 
  avant de confirmer.
- **Stockage local uniquement** : SQLite (better-sqlite3), pas de base de 
  données distante, pas de cloud payant.
- **Toujours transférer au gérant** pour : événements spéciaux (mariage, 
  anniversaire, privatisation), réclamations, et toute demande hors-FAQ 
  que l'IA ne peut pas traiter avec confiance.
- **Notifications au gérant** via WhatsApp directement (pas d'email, le 
  gérant ne le consulte pas régulièrement).

## Stack technique

- **Runtime** : Node.js
- **WhatsApp** : whatsapp-web.js + qrcode-terminal (affichage QR au démarrage)
- **Base de données** : SQLite via better-sqlite3
- **Dashboard** : Express + EJS ou HTML simple servi statiquement
- **IA pour cas ambigus** : API Anthropic (Claude), clé dans `.env` (jamais commitée)
- **Process manager (déploiement)** : pm2 (redémarrage auto en cas de crash)
- **Cron** : node-cron pour le récap quotidien au gérant

## Structure du projet

```
/config
  restaurant.json       → données métier du restaurant (source de vérité)
/db
  init.js               → création des tables SQLite (reservations, messages_a_traiter)
  dar-dzayer.db          → fichier base de données (généré, ne pas commit)
/handlers
  messageHandler.js      → routeur principal des messages entrants
/services
  faqService.js           → recherche par mots-clés (horaires/menu/livraison)
  reservationService.js   → logique de réservation + vérification disponibilité
  aiService.js             → appel API Claude pour cas ambigus
  notificationService.js   → envoi d'alertes WhatsApp au gérant
/dashboard
  server.js                → serveur Express du dashboard
  /views                   → pages du dashboard
/logs                       → logs de conversation (fichiers, pas de BDD)
index.js                     → point d'entrée, init client WhatsApp
.env.example                 → variable ANTHROPIC_API_KEY (template, sans vraie clé)
```

## Logique métier essentielle

### Flow de traitement d'un message entrant
1. Premier contact → message de bienvenue
2. Recherche mots-clés FAQ (`mots_cles_faq` dans la config) → réponse directe si match
3. Si intention "réservation" détectée → démarrer le flow de réservation 
   (conversation à états, suivie par numéro de téléphone)
4. Si intention "événement spécial" détectée → transfert direct au gérant, 
   pas de tentative de traitement automatique
5. Si aucun match → tentative via API Claude (contexte = restaurant.json) 
   → si confiance insuffisante → transfert au gérant + log dans 
   `messages_a_traiter`

### Flow de réservation (état par numéro de téléphone)
Collecter dans l'ordre : date → heure → nombre de personnes → nom.
Puis :
1. Filtrer les tables avec `capacite >= nombre_personnes`
2. Vérifier qu'aucune réservation existante ne chevauche le créneau 
   (créneau + `duree_occupation_table_minutes`) pour ces tables
3. Si table dispo → assigner, enregistrer, confirmer au client avec récap
4. Si aucune table dispo → proposer le créneau le plus proche disponible, 
   ou informer que c'est complet et proposer de transférer au gérant

### Notifications
- Nouvelle demande transférée → message WhatsApp immédiat au `telephone_gerant`
- Récap quotidien (cron matin) → liste des réservations du jour

## Conventions de code

- JavaScript (Node.js), pas de TypeScript pour ce projet (simplicité)
- Un service = une responsabilité claire (ne pas mélanger FAQ et réservation 
  dans le même fichier)
- Noms de variables en français autorisés pour les données métier 
  (ex: `nombrePersonnes`), code structurel en anglais
- Toujours logger les erreurs et les conversations transférées dans `/logs`

## Ce qu'il NE FAUT PAS faire

- Ne jamais hardcoder les horaires/prix/tables dans le code — tout vient 
  de `restaurant.json`
- Ne pas utiliser de plateforme tierce payante (Twilio payant, Zapier, etc.)
- Ne pas confirmer une réservation sans vérifier la disponibilité réelle
- Ne pas laisser l'IA traiter elle-même les événements spéciaux ou réclamations 
  — transfert systématique au gérant
- Ne pas committer `.env` ou le fichier `.db` dans git

## Workflow de développement recommandé

1. Setup + connexion WhatsApp (QR code)
2. FAQ simple (mots-clés)
3. Système de réservation + anti-double-booking (tester intensivement)
4. Détection cas complexes + alerte gérant
5. Couche IA (Claude) pour réduire les transferts inutiles
6. Dashboard de gestion
7. Notification quotidienne automatique (cron)
8. Tests de bout en bout
9. Déploiement avec pm2

Valider chaque étape avec l'utilisateur avant de passer à la suite, 
particulièrement l'étape 3 (réservation) qui est la plus sensible aux erreurs.