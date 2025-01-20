import { google } from 'googleapis';
// 1) Notre Regex pour repérer une adresse
// Exemple : "12 rue de la République"
const ADDRESS_REGEX = /(\d+\s+(?:rue|avenue|av|boulevard|bd|allée|place)\s+[^\.,]+)/i;

function extractAddress(messageText) {
  // On applique la regex au texte qu'on reçoit
  const match = messageText.match(ADDRESS_REGEX);
  if (match) {
    // match[0] contient le texte capturé (ex. "12 rue de la République")
    return match[0];
  }
  // Sinon, on renvoie null
  return null;
}
// Correction via LanguageTool (petit quota gratuit)
async function correctText(text) {
  // URL de l'API publique LanguageTool
  const url = 'https://api.languagetool.org/v2/check';

  // On prépare les paramètres à envoyer (langue = fr)
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('language', 'fr');

  // On utilise fetch (Node 18+ sur Vercel l'a par défaut)
  // Si besoin, "npm install node-fetch" puis "import fetch from 'node-fetch';"
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  // "data" contient les correspondances (matches) de fautes/erreurs
  const data = await response.json();
  // data.matches = tableau d'erreurs relevées

  let correctedText = text;
  // On parcourt les erreurs de la fin au début (pour ne pas décaler les indices)
  for (let i = data.matches.length - 1; i >= 0; i--) {
    const match = data.matches[i];
    // On prend la 1re suggestion
    if (match.replacements && match.replacements.length > 0) {
      const replacement = match.replacements[0].value;
      const startIndex = match.offset;
      const endIndex = startIndex + match.length;
      // On reconstitue la chaîne corrigée
      correctedText =
        correctedText.slice(0, startIndex) +
        replacement +
        correctedText.slice(endIndex);
    }
  }
  return correctedText;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // 1) Récupérer les données envoyées par Twilio
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
    }
    const querystring = require('querystring');
    const parsedBody = querystring.parse(rawBody);

    const from = parsedBody.From;
    const messageText = parsedBody.Body || "";
// 2) Extraire l'adresse
const adresse = extractAddress(messageText);
// 2) Corriger le texte
const correctedText = await correctText(messageText);

    // 2) Authentifier auprès de Google Sheets
    try {
      // Récupère la clé JSON stockée en variable d’environnement Vercel
      const serviceAccount = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
      const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        null,
        serviceAccount.private_key,
        ["https://www.googleapis.com/auth/spreadsheets"] // scope
      );

      // 3) Créer un client Google Sheets
      const sheets = google.sheets({ version: "v4", auth: jwtClient });

      // 4) Définir l'ID de ta Google Sheet et la plage
      //    (Remplace L_ID_DE_TA_SHEET par le vrai ID de ta feuille)
      const spreadsheetId = "1ufEO9--vJOqnXuH4-XtpXWd1z7P_d8K7aLNRdzRnVuc"; 
      const range = "Feuille1!A:D"; // Les colonnes A, B, C, D

      // 5) Construire la ligne à ajouter
      //    On veut : Date, Expéditeur, (Adresse s'il y en a), Description
      //    Pour l'instant, on fait simple : on met l'heure, l'expéditeur, et le message tel quel
      const newRow = [
        new Date().toISOString(),  // Date en ISO
        
        from,                      // Expéditeur
        adresse || "",                        // Adresse (vide pour l'instant)
        correctedText                // Description / message
      ];

      // 6) Envoyer la requête "append"
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [ newRow ],
        },
      });

      console.log("Données ajoutées à Google Sheets !");
    } catch (err) {
      console.error("Erreur Google Sheets:", err);
    }

    // 7) Répondre à Twilio
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`
      <Response>
        <Message>Nous avons bien reçu votre message, merci !</Message>
      </Response>
    `);
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
