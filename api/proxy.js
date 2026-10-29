export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-hf-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hfToken = req.headers['x-hf-token'];
  const targetUrl = req.query.url;

  if (!hfToken || !targetUrl) {
    return res.status(400).json({ error: "Missing HF Token or Target URL in request" });
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${hfToken.trim()}`,
        'Content-Type': 'application/json',
      }
    };

    // Agar body hai to JSON string me convert karo (POST/PUT ke liye)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    // Response text padho (kabhi kabhi HF JSON ke sath error text bhi bhejta hai)
    const textData = await response.text();
    let jsonData;
    
    try {
      jsonData = JSON.parse(textData);
    } catch (e) {
      jsonData = { raw: textData }; // Agar JSON nahi hai to raw bhej do
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: jsonData.error || jsonData.message || `API Error: ${response.status}`,
        details: jsonData
      });
    }

    res.status(200).json(jsonData);
  } catch (error) {
    res.status(500).json({ error: "Proxy Error: " + error.message });
  }
}