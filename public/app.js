let HF_TOKEN = sessionStorage.getItem('hf_token') || '';

// 🔥 Logger Function
function log(message, type = 'info') {
  const logBody = document.getElementById('logBody');
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `log-${type}`;
  div.innerText = `[${time}] ${message}`;
  logBody.appendChild(div);
  logBody.scrollTop = logBody.scrollHeight; // Auto-scroll to bottom
}

function clearLogs() {
  document.getElementById('logBody').innerHTML = '';
  log("Logs cleared.", "info");
}

window.onload = () => {
  if (HF_TOKEN) {
    log("Session found. Logging in...", "info");
    showDashboard();
  } else {
    log("Waiting for token...", "info");
  }
};

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

// 🚀 LOGIN FUNCTION WITH DEEP LOGGING
async function login() {
  const token = document.getElementById('tokenInput').value.trim();
  const errorBox = document.getElementById('loginError');
  
  if (!token.startsWith('hf_')) {
    errorBox.innerText = 'Invalid format. Token must start with "hf_"';
    log("Login Failed: Token format invalid.", "error");
    return;
  }

  errorBox.innerText = 'Connecting...';
  errorBox.style.color = '#3b82f6';
  log(`Attempting to connect with token: ${token.substring(0, 7)}...`, "info");

  try {
    // Proxy ke through Whoami call
    const response = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/whoami')}`, {
      method: 'GET',
      headers: { 'x-hf-token': token }
    });

    const data = await response.json();
    log("Proxy Response Status: " + response.status, "info");

    if (response.ok && data.name) {
      log(`✅ Success! Welcome, ${data.name}`, "success");
      HF_TOKEN = token;
      sessionStorage.setItem('hf_token', token);
      showDashboard();
    } else {
      // Proxy ne error bheja
      const errorMsg = data.error || data.message || "Unknown Error";
      log(`❌ Login Failed: ${errorMsg}`, "error");
      if (data.details) log(`Details: ${JSON.stringify(data.details)}`, "warn");
      
      errorBox.innerText = errorMsg;
      errorBox.style.color = '#ef4444';
    }
  } catch (err) {
    log(`❌ Network/Proxy Error: ${err.message}`, "error");
    errorBox.innerText = "Network Error. Check logs below.";
    errorBox.style.color = '#ef4444';
  }
}

function logout() {
  log("Logging out...", "warn");
  sessionStorage.removeItem('hf_token');
  setTimeout(() => location.reload(), 500);
}

function openTab(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
  log(`Switched to ${tabId} tab.`, "info");
}

// ==========================================
// TAB 1: INFERENCE
// ==========================================
async function runInference() {
  const model = document.getElementById('infModel').value;
  const prompt = document.getElementById('infPrompt').value;
  const resultBox = document.getElementById('infResult');
  
  if (!prompt) { log("Please enter a prompt.", "warn"); return; }
  
  resultBox.innerText = 'Generating...';
  log(`Sending inference request to model: ${model}`, "info");

  try {
    // Inference direct frontend se (CORS allowed)
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });
    
    const data = await res.json();
    log("Inference Response Received.", "success");
    resultBox.innerText = JSON.stringify(data, null, 2);
  } catch (error) {
    log(`Inference Error: ${error.message}`, "error");
    resultBox.innerText = "Error: " + error.message;
  }
}

// ==========================================
// TAB 2: REPOSITORIES
// ==========================================
async function fetchRepos() {
  const repoList = document.getElementById('repoList');
  const username = prompt("Enter your Hugging Face Username:");
  if (!username) return;

  repoList.innerHTML = 'Loading...';
  log(`Fetching repositories for ${username}...`, "info");
  
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(`https://huggingface.co/api/models?author=${username}`)}`, {
      headers: { 'x-hf-token': HF_TOKEN }
    });
    const data = await res.json();
    
    if (Array.isArray(data)) {
      log(`Found ${data.length} repositories.`, "success");
      repoList.innerHTML = data.map(repo => `
        <div class="list-item">
          <strong>${repo.id}</strong> <br>
          <small>Downloads: ${repo.downloads} | Likes: ${repo.likes}</small>
        </div>
      `).join('');
    } else {
      log(`Error fetching repos: ${data.error || 'Unknown Error'}`, "error");
      repoList.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
  } catch(e) {
    log(`Fetch Repos Error: ${e.message}`, "error");
  }
}

async function createRepo() {
  const repoName = prompt("Enter new model name:");
  if (!repoName) return;
  const username = prompt("Enter your HF Username:");
  
  log(`Creating repository: ${repoName}...`, "info");
  
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/repos/create')}`, {
      method: 'POST',
      headers: { 
        'x-hf-token': HF_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        organization: username,
        type: "model",
        private: false
      })
    });
    
    const data = await res.json();
    if(res.ok) {
      log(`✅ Repo created: ${data.url}`, "success");
      alert("Success!\n" + JSON.stringify(data, null, 2));
      fetchRepos();
    } else {
      log(`❌ Failed to create repo: ${data.error}`, "error");
      alert("Error: " + JSON.stringify(data, null, 2));
    }
  } catch(e) {
    log(`Create Repo Error: ${e.message}`, "error");
  }
}

// ==========================================
// TAB 3: WEBHOOKS
// ==========================================
async function fetchWebhooks() {
  const list = document.getElementById('webhookList');
  list.innerHTML = 'Loading...';
  log("Fetching webhooks...", "info");
  
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/webhooks')}`, {
      headers: { 'x-hf-token': HF_TOKEN }
    });
    const data = await res.json();
    
    if (Array.isArray(data) && data.length > 0) {
      log(`Found ${data.length} webhooks.`, "success");
      list.innerHTML = data.map(wh => `
        <div class="list-item">
          <strong>${wh.url}</strong><br>
          <small>ID: ${wh.id}</small>
        </div>
      `).join('');
    } else if(data.error) {
      log(`Webhook Error: ${data.error}`, "error");
      list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
    } else {
      log("No webhooks found.", "warn");
      list.innerHTML = 'No webhooks found.';
    }
  } catch(e) {
    log(`Fetch Webhooks Error: ${e.message}`, "error");
  }
}