export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-hf-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let hfToken = req.headers['x-hf-token'];
  let targetUrl = req.query.url;

  if (!hfToken || !targetUrl) {
    return res.status(400).json({ error: "Missing Token or URL" });
  }

  // Token ko clean karo
  hfToken = hfToken.trim().replace(/\s+/g, '');
  
  // URL decode karo
  targetUrl = decodeURIComponent(targetUrl);

  try {
    // 🔥 TRICK: Header ke sath-sath URL me bhi auth bhej rahe hain (Double Security)
    const separator = targetUrl.includes('?') ? '&' : '?';
    const finalUrl = `${targetUrl}${separator}auth=Bearer%20${hfToken}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${hfToken}`, // Header method
        'Content-Type': 'application/json',
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(finalUrl, fetchOptions);
    
    const textData = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch (e) {
      jsonData = { message: textData };
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: jsonData.error || jsonData.message || `HF API Error (Status: ${response.status})`,
        details: jsonData 
      });
    }

    res.status(200).json(jsonData);

  } catch (error) {
    res.status(500).json({ error: "Proxy Error: " + error.message });
  }
}