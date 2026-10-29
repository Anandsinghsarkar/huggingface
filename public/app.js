let HF_TOKEN = sessionStorage.getItem('hf_token') || '';

window.onload = () => {
  if (HF_TOKEN) {
    showDashboard();
  }
};

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

// 🔥 NEW & IMPROVED LOGIN FUNCTION
async function login() {
  const token = document.getElementById('tokenInput').value.trim();
  const errorBox = document.getElementById('loginError');
  
  if (!token.startsWith('hf_')) {
    errorBox.innerText = 'Invalid format. Token must start with "hf_"';
    return;
  }

  errorBox.innerText = 'Connecting & Verifying Token...';
  errorBox.style.color = '#3b82f6'; // Blue color for loading

  try {
    // Direct Inference API call for testing
    const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: "Hello" })
    });

    // Agar token galat hoga to 401 (Unauthorized) aayega
    if (response.status === 401) {
      throw new Error("Invalid Token (401 Unauthorized). Please check permissions.");
    }

    // Agar 503 (Model Loading) aaya to bhi token valid hota hai
    if (response.status === 503 || response.ok) {
      HF_TOKEN = token;
      sessionStorage.setItem('hf_token', token);
      showDashboard();
    } else {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to verify token");
    }
  } catch (err) {
    errorBox.innerText = err.message;
    errorBox.style.color = '#ef4444'; // Red color for error
  }
}

function logout() {
  sessionStorage.removeItem('hf_token');
  location.reload();
}

function openTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}

// Helper for Management API (Repos, Webhooks, etc.)
async function callHF(endpoint, method = 'GET', body = null) {
  const url = `https://huggingface.co${endpoint}`;
  const options = {
    method: method,
    headers: { 
      'x-hf-token': HF_TOKEN,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, options);
  return await res.json();
}

// ==========================================
// TAB 1: INFERENCE
// ==========================================
async function runInference() {
  const model = document.getElementById('infModel').value;
  const prompt = document.getElementById('infPrompt').value;
  const resultBox = document.getElementById('infResult');
  resultBox.innerText = 'Generating... Please wait.';

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });
    
    const data = await res.json();
    resultBox.innerText = JSON.stringify(data, null, 2);
  } catch (error) {
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
  
  const data = await callHF(`/api/models?author=${username}`);
  
  if (Array.isArray(data)) {
    repoList.innerHTML = data.map(repo => `
      <div class="list-item">
        <strong>${repo.id}</strong> <br>
        <small>Downloads: ${repo.downloads} | Likes: ${repo.likes}</small>
      </div>
    `).join('');
  } else {
    repoList.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

async function createRepo() {
  const repoName = prompt("Enter new model name:");
  if (!repoName) return;
  
  const username = prompt("Enter your HF Username:");
  
  // HF Create Repo API
  const data = await callHF('/api/repos/create', 'POST', {
    name: repoName,
    organization: username, // Optional, if creating under user
    type: "model",
    private: false
  });
  
  alert("Response:\n" + JSON.stringify(data, null, 2));
  fetchRepos();
}

// ==========================================
// TAB 3: WEBHOOKS
// ==========================================
async function fetchWebhooks() {
  const list = document.getElementById('webhookList');
  list.innerHTML = 'Loading...';
  
  const data = await callHF('/api/webhooks');
  
  if (Array.isArray(data) && data.length > 0) {
    list.innerHTML = data.map(wh => `
      <div class="list-item">
        <strong>${wh.url}</strong><br>
        <small>ID: ${wh.id}</small>
      </div>
    `).join('');
  } else if(data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
  } else {
    list.innerHTML = 'No webhooks found.';
  }
}

// ==========================================
// TAB 4: JOBS
// ==========================================
async function fetchJobs() {
  const list = document.getElementById('jobList');
  list.innerHTML = 'Loading...';
  
  const data = await callHF('/api/jobs');
  
  if (Array.isArray(data) && data.length > 0) {
    list.innerHTML = data.map(job => `
      <div class="list-item">
        <strong>Job ID: ${job.id}</strong><br>
        <small>Status: ${job.status}</small>
      </div>
    `).join('');
  } else if(data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
  } else {
    list.innerHTML = 'No active jobs found.';
  }
}