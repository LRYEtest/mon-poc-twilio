export default async function handler(req, res) {
  if (req.method === 'POST') {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
    }

    const querystring = require('querystring');
    const parsedBody = querystring.parse(rawBody);

    console.log("=== Un message est arrivé ! ===");
    console.log("Expéditeur :", parsedBody.From);
    console.log("Contenu :", parsedBody.Body);

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
