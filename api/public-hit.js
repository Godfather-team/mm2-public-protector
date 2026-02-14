// api/public-hit.js

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST kabul edilir' });
  }

  // Gizli key kontrolü (script'ten gönderilecek)
  const secretKey = req.query.key;
  if (secretKey !== process.env.SECRET_KEY) {  // Env'den çekilecek
    return res.status(403).json({ error: 'Geçersiz erişim' });
  }

  // Body'yi al
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).json({ error: 'Geçersiz JSON' });
  }

  // Senin public hit'ine özel basit validation
  if (!payload.embeds || payload.embeds.length === 0) {
    return res.status(400).json({ error: 'Embed eksik' });
  }

  const embed = payload.embeds[0];
  if (!embed.title || !embed.title.includes('GodFather • HIT')) {
    return res.status(403).json({ error: 'Başlık geçersiz' });
  }

  if (!payload.content || !payload.content.includes('@everyone New Hit')) {
    return res.status(403).json({ error: 'Content geçersiz' });
  }

  // Gerçek webhook'u ENV'den çek (script'te görünmez)
  const REAL_WEBHOOK = process.env.REAL_WEBHOOK_URL;

  if (!REAL_WEBHOOK) {
    return res.status(500).json({ error: 'Webhook ayarlanmamış' });
  }

  try {
    const response = await fetch(REAL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Discord hatası' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
};
