export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-hf-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hfToken = req.headers['x-hf-token'];
  let targetUrl = req.query.url;

  if (!hfToken || !targetUrl) {
    return res.status(400).json({ error: "Missing Token or URL in request" });
  }

  // 🛠️ FIX: Agar URL me extra slash hai, toh theek karo
  targetUrl = decodeURIComponent(targetUrl).replace(/([^:]\/)\/+/g, "$1");

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${hfToken.trim()}`,
        'Content-Type': 'application/json',
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    // Status Code aur Text padho
    const textData = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch (e) {
      jsonData = { message: textData || "Unknown response from HF" };
    }

    // Agar HF ne error diya (401, 403, 404 etc.)
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: jsonData.error || jsonData.message || `HF API Error (Status: ${response.status})`,
        details: jsonData 
      });
    }

    // Success Response
    res.status(200).json(jsonData);

  } catch (error) {
    // Network ya Server error
    res.status(500).json({ error: "Proxy Server Error: " + error.message });
  }
}