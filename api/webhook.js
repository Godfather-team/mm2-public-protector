// Discord Webhook Proxy - Güvenlik Katmanlı
// Vercel Serverless Function

// Basit in-memory rate limiter (IP bazlı)
const rateLimitMap = new Map();

// Rate limit temizleme (1 dakika sonra eski entry'leri sil)
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
        if (now - data.timestamp > 60000) {
            rateLimitMap.delete(ip);
        }
    }
}, 60000);

// Rate limit kontrolü
function checkRateLimit(ip) {
    const now = Date.now();
    const data = rateLimitMap.get(ip);
    
    if (!data || now - data.timestamp > 60000) {
        // Yeni periyot başlat
        rateLimitMap.set(ip, { count: 1, timestamp: now });
        return true;
    }
    
    if (data.count >= 10) {
        // Limit aşıldı
        return false;
    }
    
    // Sayacı artır
    data.count++;
    return true;
}

module.exports = async (req, res) => {
    // Sadece POST kabul et
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // CORS header'ları (her yerden POST kabul)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Preflight request için
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // IP adresini al (Vercel'de req.headers['x-forwarded-for'])
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     'unknown';
    
    // Rate limit kontrolü
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    
    // Secret key kontrolü (query param)
    const providedKey = req.query.key;
    const secretKey = process.env.SECRET_KEY;
    
    if (!providedKey || providedKey !== secretKey) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Gerçek webhook URL kontrolü
    const realWebhookUrl = process.env.REAL_WEBHOOK_URL;
    if (!realWebhookUrl) {
        console.error('REAL_WEBHOOK_URL not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Body JSON kontrolü
    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    // Embeds zorunlu kontrolü
    if (!body.embeds || !Array.isArray(body.embeds) || body.embeds.length === 0) {
        return res.status(400).json({ error: 'Missing or empty embeds array' });
    }
    
    // Gerçek webhook'a istek at
    try {
        const response = await fetch(realWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        
        // Discord response'unu client'a ilet
        const responseBody = await response.text();
        
        res.status(response.status).send(responseBody);
        
    } catch (error) {
        // Hata logla ama detay verme
        console.error('Webhook proxy error');
        res.status(500).json({ error: 'Error' });
    }
};
