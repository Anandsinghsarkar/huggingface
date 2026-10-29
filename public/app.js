let HF_TOKEN = sessionStorage.getItem('hf_token') || '';

// ==========================================
// LOGGER SYSTEM
// ==========================================
function log(message, type = 'info') {
  const logBody = document.getElementById('logBody');
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `log-${type}`;
  div.innerText = `[${time}] ${message}`;
  logBody.appendChild(div);
  logBody.scrollTop = logBody.scrollHeight;
}

function clearLogs() { 
  document.getElementById('logBody').innerHTML = ''; 
  log("Logs cleared.", "info"); 
}

// ==========================================
// APP INIT & AUTH
// ==========================================
window.onload = () => { 
  if (HF_TOKEN) {
    log("Session found. Auto-logging in...", "info");
    showDashboard();
  }
};

function showDashboard() { 
  document.getElementById('loginScreen').classList.add('hidden'); 
  document.getElementById('dashboard').classList.remove('hidden'); 
}

async function login() {
  const token = document.getElementById('tokenInput').value.replace(/\s+/g, '');
  const errorBox = document.getElementById('loginError');
  
  if (!token.startsWith('hf_') || token.length < 30) { 
    errorBox.innerText = 'Invalid token format.'; 
    log("Login failed: Invalid format.", "error");
    return; 
  }
  
  errorBox.innerText = "Connecting...";
  errorBox.style.color = "#3b82f6";
  log("Connecting to Hugging Face...", "info");

  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/whoami-v2')}`, {
      headers: { 'x-hf-token': token }
    });
    const data = await res.json();
    
    if (res.ok && data.name) {
      HF_TOKEN = token; 
      sessionStorage.setItem('hf_token', token);
      log(`✅ Welcome, ${data.name}!`, "success"); 
      showDashboard();
    } else {
      log(`❌ Failed: ${data.error || 'Invalid Token'}`, "error"); 
      errorBox.innerText = data.error || "Invalid Token";
      errorBox.style.color = "#ef4444";
    }
  } catch (e) { 
    log(`❌ Network Error: ${e.message}`, "error"); 
    errorBox.innerText = "Network Error";
    errorBox.style.color = "#ef4444";
  }
}

function logout() { 
  sessionStorage.removeItem('hf_token'); 
  log("Logging out...", "info");
  setTimeout(() => location.reload(), 500);
}

// ==========================================
// NAVIGATION & HELPERS
// ==========================================
function openTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  
  if(tabId === 'datasets') {
    document.getElementById('datasetDetails').classList.add('hidden');
    document.getElementById('datasetList').parentElement.classList.remove('hidden');
  }
}

async function callHF(endpoint, method = 'GET', body = null) {
  const url = `https://huggingface.co${endpoint}`;
  const opt = { method, headers: { 'x-hf-token': HF_TOKEN } };
  if (body) { 
    opt.headers['Content-Type'] = 'application/json'; 
    opt.body = JSON.stringify(body); 
  }
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, opt);
  return await res.json();
}

// ==========================================
// 1. INFERENCE
// ==========================================
async function runInference() {
  const model = document.getElementById('infModel').value;
  const prompt = document.getElementById('infPrompt').value;
  const resultBox = document.getElementById('infResult');
  
  if(!prompt) { log("Prompt required", "warn"); return; }
  
  resultBox.innerText = 'Generating...';
  log(`Running inference on ${model}...`, "info");
  
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt })
    });
    const data = await res.json();
    resultBox.innerText = JSON.stringify(data, null, 2);
    log("Inference completed.", "success");
  } catch(e) { 
    resultBox.innerText = "Error: " + e.message;
    log(`Inference error: ${e.message}`, "error"); 
  }
}

// ==========================================
// 2. REPOSITORIES
// ==========================================
async function fetchRepos() {
  const list = document.getElementById('repoList');
  list.innerText = 'Loading...';
  log("Fetching repositories...", "info");
  
  const data = await callHF('/api/models?author=Anandsinghsarkar'); // Change author if needed
  
  if (Array.isArray(data)) {
    list.innerHTML = data.map(r => `
      <div class="list-item">
        <strong>${r.id}</strong><br>
        <small>⬇️ ${r.downloads} | ❤️ ${r.likes}</small>
      </div>
    `).join('') || 'No repos found.';
    log(`${data.length} repos loaded.`, "success");
  } else { 
    list.innerText = JSON.stringify(data); 
    log(`Repo error: ${data.error}`, "error"); 
  }
}

async function createRepo() {
  const name = prompt("Enter Repo Name:");
  if (!name) return;
  log(`Creating Repo ${name}...`, "info");
  const data = await callHF('/api/repos/create', 'POST', { name: name, type: "model", private: false });
  if (data.url) { 
    log(`✅ Repo Created: ${data.url}`, "success"); 
    alert("Created!"); 
    fetchRepos(); 
  } else { 
    log(`❌ Create Failed: ${data.error}`, "error"); 
    alert(JSON.stringify(data)); 
  }
}

// ==========================================
// 3. DATASETS
// ==========================================
async function searchDatasets() {
  const query = document.getElementById('datasetSearch').value.trim();
  const list = document.getElementById('datasetList');
  const details = document.getElementById('datasetDetails');
  
  details.classList.add('hidden');
  list.parentElement.classList.remove('hidden');
  list.innerHTML = 'Searching...';
  log(`Searching datasets for: "${query}"`, "info");

  try {
    const data = await callHF(`/api/datasets?search=${encodeURIComponent(query)}&limit=20`);
    
    if (Array.isArray(data)) {
      if (data.length === 0) {
        list.innerHTML = 'No datasets found.';
        log("No datasets found.", "warn");
        return;
      }
      log(`Found ${data.length} datasets.`, "success");
      
      list.innerHTML = data.map(ds => `
        <div class="list-item" style="cursor: pointer;" onclick="viewDatasetDetails('${ds.id}')">
          <strong>${ds.id}</strong><br>
          <small>⬇️ ${ds.downloads || 0} | ❤️ ${ds.likes || 0}</small>
          <div style="margin-top: 5px; font-size: 12px; color: #94a3b8;">Tags: ${(ds.tags || []).slice(0, 3).join(', ')}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      log(`Search Error: ${data.error}`, "error");
    }
  } catch (error) {
    list.innerHTML = `Error: ${error.message}`;
    log(`Search Error: ${error.message}`, "error");
  }
}

async function viewDatasetDetails(datasetId) {
  const list = document.getElementById('datasetList');
  const details = document.getElementById('datasetDetails');
  const title = document.getElementById('dsTitle');
  const content = document.getElementById('dsContent');

  log(`Fetching details for: ${datasetId}`, "info");
  title.innerText = datasetId;
  content.innerHTML = 'Loading...';
  
  list.parentElement.classList.add('hidden');
  details.classList.remove('hidden');

  try {
    const data = await callHF(`/api/datasets/${datasetId}`);
    
    if (data.error) {
      content.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
      return;
    }

    let html = `
      <div class="list-item" style="border-left-color: #10b981;">
        <strong>Author:</strong> ${data.author || 'Unknown'}<br>
        <strong>Downloads:</strong> ${data.downloads || 0}<br>
        <strong>Likes:</strong> ${data.likes || 0}<br>
        <strong>Last Modified:</strong> ${new Date(data.lastModified).toLocaleString()}<br>
        <strong>Private:</strong> ${data.private ? 'Yes' : 'No'}
      </div>
    `;

    if (data.tags && data.tags.length > 0) {
      html += `<h4 style="margin-top:15px; margin-bottom:5px;">Tags:</h4>
               <div style="display:flex; flex-wrap:wrap; gap:5px;">
                 ${data.tags.map(t => `<span style="background:#334155; padding:4px 8px; border-radius:4px; font-size:12px;">${t}</span>`).join('')}
               </div>`;
    }

    if (data.siblings && data.siblings.length > 0) {
      html += `<h4 style="margin-top:15px; margin-bottom:5px;">Files (${data.siblings.length}):</h4>
               <div class="list-container" style="max-height: 200px; overflow-y: auto;">`;
      data.siblings.slice(0, 15).forEach(file => {
        html += `<div class="list-item" style="padding: 8px; font-size:13px; border-left-color: #3b82f6;">📄 ${file.rfilename}</div>`;
      });
      if (data.siblings.length > 15) html += `<small>...and ${data.siblings.length - 15} more files</small>`;
      html += `</div>`;
    }

    content.innerHTML = html;
    log(`Details loaded for ${datasetId}`, "success");

  } catch (error) {
    content.innerHTML = `Error: ${error.message}`;
    log(`Details Error: ${error.message}`, "error");
  }
}

function closeDatasetDetails() {
  document.getElementById('datasetDetails').classList.add('hidden');
  document.getElementById('datasetList').parentElement.classList.remove('hidden');
}

// ==========================================
// 4. WEBHOOKS
// ==========================================
async function fetchWebhooks() {
  const list = document.getElementById('webhookList');
  list.innerText = 'Loading...';
  log("Fetching Webhooks...", "info");
  
  const data = await callHF('/api/webhooks');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(w => `
      <div class="list-item">
        <strong>${w.url}</strong><br>
        <small>ID: ${w.id}</small>
      </div>
    `).join('') || 'No webhooks.';
    log("Webhooks loaded", "success");
  } else { 
    list.innerText = JSON.stringify(data); 
  }
}

async function createWebhook() {
  const url = prompt("Enter Webhook Target URL:");
  if (!url) return;
  log(`Creating Webhook...`, "info");
  const data = await callHF('/api/webhooks', 'POST', { url: url, watched: [{ type: "user" }] });
  if (data.id) { 
    log("✅ Webhook Created", "success"); 
    fetchWebhooks(); 
  } else { 
    log(`❌ Failed: ${data.error}`, "error"); 
    alert(JSON.stringify(data)); 
  }
}

// ==========================================
// 5. JOBS
// ==========================================
async function fetchJobs() {
  const list = document.getElementById('jobList');
  list.innerText = 'Loading...';
  log("Fetching Jobs...", "info");
  
  const data = await callHF('/api/jobs');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(j => `
      <div class="list-item">
        <strong>Job: ${j.id}</strong><br>
        <small>Status: ${j.status}</small>
      </div>
    `).join('') || 'No jobs.';
    log("Jobs loaded", "success");
  } else { 
    list.innerText = JSON.stringify(data); 
  }
}

// ==========================================
// 6. COLLECTIONS
// ==========================================
async function fetchCollections() {
  const list = document.getElementById('collectionList');
  list.innerText = 'Loading...';
  log("Fetching Collections...", "info");
  
  const data = await callHF('/api/collections');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(c => `
      <div class="list-item">
        <strong>${c.title}</strong><br>
        <small>Slug: ${c.slug}</small>
      </div>
    `).join('') || 'No collections.';
    log("Collections loaded", "success");
  } else { 
    list.innerText = JSON.stringify(data); 
  }
}

// ==========================================
// 7. DISCUSSIONS
// ==========================================
async function fetchDiscussions() {
  const repo = document.getElementById('discRepo').value;
  const list = document.getElementById('discussionList');
  
  if (!repo) { alert("Enter model ID first"); return; }
  
  list.innerText = 'Loading...';
  log(`Fetching Discussions for ${repo}...`, "info");
  
  const data = await callHF(`/api/models/${repo}/discussions`);
  if (Array.isArray(data)) {
    list.innerHTML = data.map(d => `
      <div class="list-item">
        <strong>${d.title}</strong><br>
        <small>By: ${d.author.name}</small>
      </div>
    `).join('') || 'No discussions.';
    log("Discussions loaded", "success");
  } else { 
    list.innerText = JSON.stringify(data); 
  }
}

// ==========================================
// 8. NOTIFICATIONS
// ==========================================
async function fetchNotifications() {
  const list = document.getElementById('notifList');
  list.innerText = 'Loading...';
  log("Fetching Notifications...", "info");
  
  const data = await callHF('/api/notifications');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(n => `
      <div class="list-item">
        <strong>${n.title || 'Notification'}</strong><br>
        <small>${n.read ? '✅ Read' : '🔴 Unread'}</small>
      </div>
    `).join('') || 'Inbox clean!';
    log("Notifications loaded", "success");
  } else { 
    list.innerText = JSON.stringify(data); 
  }
}

// ==========================================
// 9. BILLING
// ==========================================
async function fetchBilling() {
  const result = document.getElementById('billingResult');
  result.innerText = 'Loading...';
  log("Fetching Billing Info...", "info");
  
  const data = await callHF('/api/billing');
  result.innerText = JSON.stringify(data, null, 2);
  log("Billing info loaded", "success");
}