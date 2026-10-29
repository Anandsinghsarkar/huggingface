// 🔥 Permanent Token (Local Storage) - Disconnect hoga sirf manual logout se
let HF_TOKEN = localStorage.getItem('hf_token') || '';
let currentRepo = '';
let loggedInUser = '';

// ==========================================
// LOGGER SYSTEM & UI TOGGLE
// ==========================================
function log(message, type = 'info') {
  const logBody = document.getElementById('logBody');
  if(!logBody) return;
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `log-${type}`;
  div.innerText = `[${time}] ${message}`;
  logBody.appendChild(div);
  logBody.scrollTop = logBody.scrollHeight;
}

function toggleLogs() {
  const consoleBox = document.getElementById('logConsole');
  if(consoleBox.classList.contains('hidden')) {
    consoleBox.classList.remove('hidden');
    const body = document.getElementById('logBody');
    body.scrollTop = body.scrollHeight;
  } else {
    consoleBox.classList.add('hidden');
  }
}

// ==========================================
// APP INIT & AUTH
// ==========================================
window.onload = () => { 
  if (HF_TOKEN) {
    log("Session found. Auto-connecting...", "success");
    showDashboard(); 
    // Background me user info fetch kar lete hain
    fetchUserInfo();
  } else {
    log("Ready to connect.", "info");
  }
};

async function fetchUserInfo() {
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/whoami-v2')}`, {
      headers: { 'x-hf-token': HF_TOKEN }
    });
    const data = await res.json();
    if (data.name) loggedInUser = data.name;
  } catch(e) { console.log("Could not fetch user info"); }
}

function showDashboard() { 
  document.getElementById('loginScreen').classList.add('hidden'); 
  document.getElementById('dashboard').classList.remove('hidden'); 
}

async function login() {
  const tokenInput = document.getElementById('tokenInput');
  const token = tokenInput.value.replace(/\s+/g, ''); 
  const errorBox = document.getElementById('loginError');
  
  if (!token.startsWith('hf_')) { 
    errorBox.innerText = 'Invalid token format.'; 
    return; 
  }
  
  log("Connecting to Hugging Face...", "info");
  errorBox.innerText = "Connecting...";
  errorBox.style.color = "#3b82f6";
  
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent('https://huggingface.co/api/whoami-v2')}`, {
      headers: { 'x-hf-token': token }
    });
    const data = await res.json();
    
    if (res.ok && data.name) {
      HF_TOKEN = token; 
      loggedInUser = data.name;
      localStorage.setItem('hf_token', token); 
      log(`✅ Welcome, ${data.name}!`, "success"); 
      showDashboard();
    } else {
      log(`❌ Failed: ${data.error || 'Invalid Token'}`, "error"); 
      errorBox.innerText = data.error || "Invalid Token";
      errorBox.style.color = "#ef4444";
    }
  } catch (e) { 
    log(`❌ Network Error: ${e.message}`, "error"); 
    errorBox.innerText = "Network Error.";
    errorBox.style.color = "#ef4444";
  }
}

// Sirf tab logout hoga jab aap button dabayenge
function logout() { 
  localStorage.removeItem('hf_token'); 
  log("Logging out...", "warn");
  setTimeout(() => location.reload(), 500);
}

// ==========================================
// NAVIGATION & API HELPER (Auto-logout removed)
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
  if(tabId === 'repos') closeFileManager();
}

async function callHF(endpoint, method = 'GET', body = null) {
  if (!HF_TOKEN) return { error: "No token" };

  const url = `https://huggingface.co${endpoint}`;
  const opt = { method, headers: { 'x-hf-token': HF_TOKEN } };
  if (body) { 
    opt.headers['Content-Type'] = 'application/json'; 
    opt.body = JSON.stringify(body); 
  }
  
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, opt);
    
    // 🔥 FIX: Agar token invalid hai (401), toh sirf error return karo, logout mat karo
    if (res.status === 401) {
      return { error: "Unauthorized: Token is invalid or expired. Please logout and login again." };
    }
    return await res.json();
  } catch(e) {
    return { error: e.message };
  }
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
  log("Fetching repos...", "info");
  
  if(!loggedInUser) await fetchUserInfo();
  
  // Dynamic Username use kar rahe hain
  const data = await callHF(`/api/models?author=${loggedInUser || 'Anandsinghsarkar'}`); 
  
  if (Array.isArray(data)) {
    list.innerHTML = data.map(r => `
      <div class="list-item" style="cursor:pointer;" onclick="openFileManager('${r.id}')">
        <strong>${r.id}</strong><br><small>⬇️ ${r.downloads} | ❤️ ${r.likes}</small>
      </div>
    `).join('') || 'No repos found.';
    log("Repos loaded", "success");
  } else { 
    list.innerText = data.error ? `Error: ${data.error}` : JSON.stringify(data); 
  }
}

async function createRepo() {
  const name = prompt("Enter Repo Name:");
  if (!name) return;
  log(`Creating Repo ${name}...`, "info");
  const data = await callHF('/api/repos/create', 'POST', { name: name, type: "model", private: false });
  if (data.url) { log(`✅ Repo Created`, "success"); fetchRepos(); }
  else { log(`❌ Failed: ${data.error}`, "error"); alert(JSON.stringify(data)); }
}

async function openFileManager(repoId) {
  currentRepo = repoId;
  document.getElementById('repoListView').classList.add('hidden');
  document.getElementById('fileManagerView').classList.remove('hidden');
  document.getElementById('repoTitle').innerText = repoId;
  hideFileEditor();
  fetchRepoFiles();
}

function closeFileManager() {
  document.getElementById('repoListView').classList.remove('hidden');
  document.getElementById('fileManagerView').classList.add('hidden');
}

async function fetchRepoFiles() {
  const list = document.getElementById('fileList');
  list.innerText = 'Loading files...';
  log(`Fetching files for ${currentRepo}...`, "info");
  
  const data = await callHF(`/api/models/${currentRepo}`);
  
  if (data.siblings) {
    list.innerHTML = data.siblings.map(f => `
      <div class="list-item" style="cursor:pointer;" onclick="editFile('${f.rfilename}')">
        📄 <strong>${f.rfilename}</strong> <span style="color:#3b82f6; font-size:12px; float:right;">Edit →</span>
      </div>
    `).join('') || 'No files in this repo.';
    log(`${data.siblings.length} files loaded.`, "success");
  } else {
    list.innerText = data.error ? `Error: ${data.error}` : JSON.stringify(data);
    log(`Error loading files: ${data.error}`, "error");
  }
}

function showNewFileForm() {
  document.getElementById('fileNameInput').value = '';
  document.getElementById('fileContentInput').value = '';
  document.getElementById('fileEditor').classList.remove('hidden');
  log("New file mode activated", "info");
}

async function editFile(filename) {
  log(`Fetching content of ${filename}...`, "info");
  try {
    const rawUrl = `https://huggingface.co/${currentRepo}/resolve/main/${filename}`;
    const res = await fetch(rawUrl);
    if(!res.ok) throw new Error("Could not fetch content");
    const content = await res.text();
    
    document.getElementById('fileNameInput').value = filename;
    document.getElementById('fileContentInput').value = content;
    document.getElementById('fileEditor').classList.remove('hidden');
    log(`✅ Loaded content of ${filename}`, "success");
  } catch (e) {
    log(`❌ Error reading file: ${e.message}`, "error");
    document.getElementById('fileNameInput').value = filename;
    document.getElementById('fileContentInput').value = "";
    document.getElementById('fileEditor').classList.remove('hidden');
  }
}

function hideFileEditor() {
  document.getElementById('fileEditor').classList.add('hidden');
}

async function commitFile() {
  const fileName = document.getElementById('fileNameInput').value.trim();
  const content = document.getElementById('fileContentInput').value;
  
  if (!fileName) { alert("File name is required"); return; }
  log(`Committing file ${fileName}...`, "info");
  
  try {
    const bytes = new TextEncoder().encode(content);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const base64Content = btoa(binaryString);
    
    const payload = {
      summary: `Update ${fileName} via HF Manager`,
      files: [{ path: fileName, content: base64Content, encoding: "base64" }]
    };

    const data = await callHF(`/api/models/${currentRepo}/commit/main`, 'POST', payload);
    
    if (data.commitOid || data.success) {
      log(`✅ File saved successfully!`, "success");
      alert("File Uploaded!");
      hideFileEditor();
      fetchRepoFiles();
    } else {
      log(`❌ Commit failed: ${data.error}`, "error");
      alert("Error: " + JSON.stringify(data));
    }
  } catch(e) {
    log(`❌ Commit error: ${e.message}`, "error");
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
  log(`Searching datasets: "${query}"`, "info");

  try {
    const data = await callHF(`/api/datasets?search=${encodeURIComponent(query)}&limit=30`);
    if (Array.isArray(data)) {
      if (data.length === 0) { list.innerHTML = 'No datasets found.'; return; }
      log(`Found ${data.length} datasets.`, "success");
      
      list.innerHTML = data.map(ds => `
        <div class="list-item" style="cursor: pointer;" onclick="viewDatasetDetails('${ds.id}')">
          <strong>${ds.id}</strong><br><small>⬇️ ${ds.downloads || 0} | ❤️ ${ds.likes || 0}</small>
        </div>
      `).join('');
    } else { list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`; }
  } catch (error) { list.innerHTML = `Error: ${error.message}`; }
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
    if (data.error) { content.innerHTML = `<span style="color:red">Error: ${data.error}</span>`; return; }

    let html = `
      <div class="list-item" style="border-left-color: #10b981;">
        <strong>Author:</strong> ${data.author || 'Unknown'}<br>
        <strong>Downloads:</strong> ${data.downloads || 0}<br>
        <strong>Last Modified:</strong> ${new Date(data.lastModified).toLocaleString()}<br>
      </div>
    `;
    if (data.siblings && data.siblings.length > 0) {
      html += `<h4 style="margin-top:15px; margin-bottom:5px;">Files (${data.siblings.length}):</h4>`;
      data.siblings.forEach(file => {
        html += `<div class="list-item" style="padding: 8px; font-size:13px; border-left-color: #3b82f6;">📄 ${file.rfilename}</div>`;
      });
    }
    content.innerHTML = html;
    log(`Details loaded`, "success");
  } catch (error) { content.innerHTML = `Error: ${error.message}`; }
}

function closeDatasetDetails() {
  document.getElementById('datasetDetails').classList.add('hidden');
  document.getElementById('datasetList').parentElement.classList.remove('hidden');
}

// ==========================================
// 4. WEBHOOKS (Fixed completely)
// ==========================================
async function fetchWebhooks() {
  const list = document.getElementById('webhookList');
  list.innerText = 'Loading...';
  log("Fetching Webhooks...", "info");
  
  if(!loggedInUser) await fetchUserInfo();
  
  // Hugging Face strictly user ID maangta hai webhooks ke liye
  const userInfo = await callHF('/api/whoami-v2');
  if (userInfo.error || !userInfo.id) {
    list.innerHTML = `<span style="color:red">Could not verify user ID.</span>`;
    return;
  }
  
  // Endpoint: /api/webhooks?user=ID
  const data = await callHF(`/api/webhooks?user=${userInfo.id}`);
  
  if (Array.isArray(data)) {
    if (data.length === 0) { 
      list.innerHTML = 'No webhooks found. Click "+ Create Webhook" to make one.';
      log("No webhooks found", "info");
      return; 
    }
    list.innerHTML = data.map(w => `
      <div class="list-item">
        <strong>${w.url}</strong><br>
        <small>Status: ${w.disabled ? '❌ Disabled' : '✅ Active'} | ID: ${w.id}</small>
      </div>
    `).join('');
    log("Webhooks loaded", "success");
  } else if (data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
    log(`Webhook error: ${data.error}`, "error");
  } else {
    list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

async function createWebhook() {
  const url = prompt("Enter Webhook Target URL (e.g. https://webhook.site/xyz):");
  if (!url) return;
  
  log("Creating Webhook...", "info");
  // HF Webhook needs specific structure
  const payload = {
    url: url,
    watched: [{ type: "user" }]
  };
  
  const data = await callHF('/api/webhooks', 'POST', payload);
  
  if (data.id) { 
    log(`✅ Webhook Created`, "success"); 
    fetchWebhooks(); 
  } else { 
    log(`❌ Webhook Failed: ${data.error}`, "error");
    alert("Error creating webhook:\n" + JSON.stringify(data, null, 2)); 
  }
}

// ==========================================
// 5. JOBS (Fixed completely)
// ==========================================
async function fetchJobs() {
  const list = document.getElementById('jobList');
  list.innerText = 'Loading...';
  log("Fetching Jobs...", "info");
  
  // Jobs API in HF: /api/jobs (Without token sometimes it fails, but with Fine-grained it should work)
  // Alternative: Some jobs are under /api/jobs/scheduled or /api/jobs/pipelines
  const data = await callHF('/api/jobs');
  
  if (Array.isArray(data)) {
    if (data.length === 0) { 
      list.innerHTML = 'No active jobs found.'; 
      log("No jobs found", "info");
      return; 
    }
    list.innerHTML = data.map(j => `
      <div class="list-item">
        <strong>Job ID: ${j.id}</strong><br>
        <small>Status: ${j.status || 'unknown'} | Created: ${j.created_at ? new Date(j.created_at).toLocaleString() : 'N/A'}</small>
      </div>
    `).join('');
    log("Jobs loaded", "success");
  } else if (data.error) {
    // Agar user ke paas jobs nahi hain toh HF direct error deta hai
    list.innerHTML = `<span style="color:#f59e0b">${data.error}</span><br><small>Note: You might not have any active Jobs or the token lacks specific job permissions.</small>`;
    log(`Job fetch info: ${data.error}`, "warn");
  } else {
    list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

// ==========================================
// 6. COLLECTIONS
// ==========================================
async function fetchCollections() {
  const list = document.getElementById('collectionList');
  list.innerText = 'Loading...';
  log("Fetching Collections...", "info");
  
  if(!loggedInUser) await fetchUserInfo();
  
  const data = await callHF(`/api/collections?owner=${loggedInUser}`);
  
  if (Array.isArray(data)) {
    if (data.length === 0) { list.innerHTML = 'No collections found.'; return; }
    list.innerHTML = data.map(c => `
      <div class="list-item">
        <strong>${c.title}</strong><br>
        <small>Slug: ${c.slug} | Items: ${c.items ? c.items.length : 0}</small>
      </div>
    `).join('');
    log("Collections loaded", "success");
  } else if (data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
    log(`Collection error: ${data.error}`, "error");
  } else {
    list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
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
    if(data.length === 0) { list.innerHTML = "No discussions found."; return; }
    list.innerHTML = data.map(d => `
      <div class="list-item">
        <strong>${d.title}</strong><br>
        <small>By: ${d.author ? d.author.name : 'Unknown'} | ${d.is_pull_request ? 'PR' : 'Discussion'}</small>
      </div>
    `).join('');
    log("Discussions loaded", "success");
  } else if (data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
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
    if (data.length === 0) { list.innerHTML = 'Inbox is clean!'; return; }
    list.innerHTML = data.map(n => `
      <div class="list-item">
        <strong>${n.title || 'Notification'}</strong><br>
        <small>${n.read ? '✅ Read' : '🔴 Unread'} | Type: ${n.type || 'System'}</small>
      </div>
    `).join('');
    log("Notifications loaded", "success");
  } else if (data.error) {
    list.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
    log(`Notification error: ${data.error}`, "error");
  } else {
    list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}

// ==========================================
// 9. BILLING
// ==========================================
async function fetchBilling() {
  const result = document.getElementById('billingResult');
  result.innerText = 'Loading...';
  log("Fetching Billing Info...", "info");
  
  const data = await callHF('/api/whoami-v2');
  
  if (data.error) {
    result.innerText = `Error: ${data.error}`;
    log(`Billing error: ${data.error}`, "error");
    return;
  }

  const billingInfo = {
    Username: data.name,
    FullName: data.fullname || 'N/A',
    Email: data.email || 'N/A',
    Plan: data.isPro ? 'PRO' : 'FREE',
    BillingMode: data.billingMode || 'N/A',
    CanPay: data.canPay ? 'Yes' : 'No',
    PeriodEnd: data.periodEnd ? new Date(data.periodEnd * 1000).toLocaleDateString() : 'N/A'
  };

  result.innerText = JSON.stringify(billingInfo, null, 2);
  log("Billing info loaded", "success");
}