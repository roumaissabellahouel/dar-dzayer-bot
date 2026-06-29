require('dotenv').config();
const Groq = require('groq-sdk');
const config = require('../config/restaurant.json');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Tu es l'assistant virtuel du restaurant "${config.nom}" à ${config.ville}, Algérie.
Tu réponds aux questions des clients en te basant UNIQUEMENT sur les informations ci-dessous.
Si tu ne peux pas répondre avec certitude, réponds UNIQUEMENT avec le mot TRANSFERT (rien d'autre).

Règles :
- Réponds en français (ou en darija si le client l'utilise)
- Ton chaleureux et professionnel, quelques emojis discrets
- 2-3 phrases maximum, très concis
- Ne jamais inventer des informations absentes des données ci-dessous

--- Données du restaurant ---
${JSON.stringify(config, null, 2)}
---`;

async function interrogerClaude(messageClient) {
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: messageClient },
    ],
  });

  const texte = response.choices[0].message.content.trim();

  if (texte.toUpperCase() === 'TRANSFERT' || texte.toUpperCase().startsWith('TRANSFERT')) {
    return { reponse: null, transfert: true };
  }

  return { reponse: texte, transfert: false };
}

module.exports = { interrogerClaude };
