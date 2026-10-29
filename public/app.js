let HF_TOKEN = sessionStorage.getItem('hf_token') || '';

// App Init
window.onload = () => {
  if (HF_TOKEN) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  }
};

// 1. LOGIN FUNCTION
function login() {
  const token = document.getElementById('tokenInput').value.trim();
  if (!token.startsWith('hf_')) {
    document.getElementById('loginError').innerText = 'Invalid token format. Must start with hf_';
    return;
  }
  
  // Token validate karne ke liye ek test call
  fetch('/api/proxy?url=https://huggingface.co/api/whoami', {
    headers: { 'x-hf-token': token }
  })
  .then(res => res.json())
  .then(data => {
    if (data.name) {
      HF_TOKEN = token;
      sessionStorage.setItem('hf_token', token);
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
    } else {
      document.getElementById('loginError').innerText = 'Invalid Token or Connection Failed';
    }
  })
  .catch(() => document.getElementById('loginError').innerText = 'Connection Error');
}

function logout() {
  sessionStorage.removeItem('hf_token');
  location.reload();
}

// Tab Switching
function openTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}

// Helper for API Calls
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

  // Proxy call
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, options);
  return await res.json();
}

// ==========================================
// TAB 1: INFERENCE (Text Generation)
// ==========================================
async function runInference() {
  const model = document.getElementById('infModel').value;
  const prompt = document.getElementById('infPrompt').value;
  const resultBox = document.getElementById('infResult');
  resultBox.innerText = 'Generating... Please wait.';

  try {
    // HF Inference API URL
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
  repoList.innerHTML = 'Loading...';
  
  // Aapke saare repos fetch karna
  const data = await callHF('/api/models?author=' + prompt("Enter your HF Username:"));
  
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
  const data = await callHF('/api/repos/create', 'POST', {
    name: repoName,
    organization: username,
    type: "model",
    private: false
  });
  
  alert("Repo Creation Response: \n" + JSON.stringify(data, null, 2));
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
        <small>ID: ${wh.id} | Models: ${wh.models ? wh.models.length : 0}</small>
      </div>
    `).join('');
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
  
  // Jobs list fetch karne ki API
  const data = await callHF('/api/jobs');
  
  if (data && data.length > 0) {
    list.innerHTML = data.map(job => `
      <div class="list-item">
        <strong>Job ID: ${job.id}</strong><br>
        <small>Status: ${job.status}</small>
      </div>
    `).join('');
  } else {
    list.innerHTML = 'No active jobs found.';
  }
}