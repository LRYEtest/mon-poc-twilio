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
        messageText                // Description / message
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
        <Message>Bien reçu, merci !</Message>
      </Response>
    `);
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
