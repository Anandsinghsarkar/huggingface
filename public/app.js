// 🔥 CHANGE 1: sessionStorage ki jagah localStorage use kiya
let HF_TOKEN = localStorage.getItem('hf_token') || '';
let currentRepo = '';
let currentFileName = '';

// ==========================================
// LOGGER SYSTEM
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
function clearLogs() { document.getElementById('logBody').innerHTML = ''; log("Logs cleared.", "info"); }

// ==========================================
// APP INIT & AUTH
// ==========================================
window.onload = () => { 
  // Agar token save hai, toh direct dashboard kholo
  if (HF_TOKEN) {
    log("Previous session found. Auto-connecting...", "success");
    showDashboard(); 
  } else {
    log("Ready to connect.", "info");
  }
};

function showDashboard() { 
  document.getElementById('loginScreen').classList.add('hidden'); 
  document.getElementById('dashboard').classList.remove('hidden'); 
}

async function login() {
  const tokenInput = document.getElementById('tokenInput');
  const token = tokenInput.value.replace(/\s+/g, ''); // Saare spaces hatao
  const errorBox = document.getElementById('loginError');
  
  if (!token.startsWith('hf_') || token.length < 30) { 
    errorBox.innerText = 'Invalid token format. Must start with hf_'; 
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
      // 🔥 CHANGE 2: localStorage me save kiya taaki permanent rahe
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
    errorBox.innerText = "Network Error. Check logs.";
    errorBox.style.color = "#ef4444";
  }
}

function logout() { 
  // 🔥 CHANGE 3: Sirf tab token delete hoga jab aap manually logout karenge
  localStorage.removeItem('hf_token'); 
  log("Logging out & clearing token...", "warn");
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
  if(tabId === 'repos') closeFileManager();
}

async function callHF(endpoint, method = 'GET', body = null) {
  const url = `https://huggingface.co${endpoint}`;
  const opt = { method, headers: { 'x-hf-token': HF_TOKEN } };
  if (body) { 
    opt.headers['Content-Type'] = 'application/json'; 
    opt.body = JSON.stringify(body); 
  }
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, opt);
  
  // Agar token expire ho gaya ho (401), toh auto logout kar do
  if (res.status === 401) {
    log("Token expired or invalid. Please reconnect.", "error");
    logout();
    return { error: "Unauthorized" };
  }
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
// 2. REPOSITORIES & FILE MANAGER
// ==========================================
async function fetchRepos() {
  const list = document.getElementById('repoList');
  list.innerText = 'Loading...';
  log("Fetching repos...", "info");
  
  // Note: Yahan 'Anandsinghsarkar' ki jagah aap dynamic username bhi laa sakte hain whoami se
  const data = await callHF('/api/models?author=Anandsinghsarkar'); 
  
  if (Array.isArray(data)) {
    list.innerHTML = data.map(r => `
      <div class="list-item" style="cursor:pointer;" onclick="openFileManager('${r.id}')">
        <strong>${r.id}</strong><br><small>⬇️ ${r.downloads} | ❤️ ${r.likes}</small>
      </div>
    `).join('') || 'No repos found.';
    log("Repos loaded", "success");
  } else { list.innerText = JSON.stringify(data); }
}

async function createRepo() {
  const name = prompt("Enter Repo Name:");
  if (!name) return;
  log(`Creating Repo ${name}...`, "info");
  const data = await callHF('/api/repos/create', 'POST', { name: name, type: "model", private: false });
  if (data.url) { 
    log(`✅ Repo Created`, "success"); 
    fetchRepos(); 
  } else { 
    log(`❌ Failed: ${data.error}`, "error"); 
    alert(JSON.stringify(data)); 
  }
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
    list.innerText = JSON.stringify(data);
    log(`Error loading files: ${data.error}`, "error");
  }
}

// 🔥 FILE CREATION / EDITING LOGIC
function showNewFileForm() {
  currentFileName = ''; 
  document.getElementById('fileNameInput').value = '';
  document.getElementById('fileContentInput').value = '';
  document.getElementById('fileEditor').classList.remove('hidden');
  log("New file mode activated", "info");
}

async function editFile(filename) {
  currentFileName = filename;
  log(`Fetching content of ${filename}...`, "info");
  
  try {
    const rawUrl = `https://huggingface.co/${currentRepo}/resolve/main/${filename}`;
    const res = await fetch(rawUrl);
    
    if(!res.ok) throw new Error("Could not fetch file content");
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
      alert("File Uploaded/Updated Successfully!");
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
          <strong>${ds.id}</strong><br>
          <small>⬇️ ${ds.downloads || 0} | ❤️ ${ds.likes || 0}</small>
          <div style="margin-top: 5px; font-size: 12px; color: #94a3b8;">Tags: ${(ds.tags || []).slice(0, 3).join(', ')}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
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
        <strong>Likes:</strong> ${data.likes || 0}<br>
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
// 4. WEBHOOKS
// ==========================================
async function fetchWebhooks() {
  const list = document.getElementById('webhookList');
  list.innerText = 'Loading...';
  const data = await callHF('/api/webhooks');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(w => `<div class="list-item"><strong>${w.url}</strong><br><small>ID: ${w.id}</small></div>`).join('') || 'No webhooks.';
  } else { list.innerText = JSON.stringify(data); }
}

async function createWebhook() {
  const url = prompt("Enter Webhook Target URL:");
  if (!url) return;
  const data = await callHF('/api/webhooks', 'POST', { url: url, watched: [{ type: "user" }] });
  if (data.id) { fetchWebhooks(); } else { alert(JSON.stringify(data)); }
}

// ==========================================
// 5. JOBS
// ==========================================
async function fetchJobs() {
  const list = document.getElementById('jobList');
  list.innerText = 'Loading...';
  const data = await callHF('/api/jobs');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(j => `<div class="list-item"><strong>Job: ${j.id}</strong><br><small>Status: ${j.status}</small></div>`).join('') || 'No jobs.';
  } else { list.innerText = JSON.stringify(data); }
}

// ==========================================
// 6. COLLECTIONS
// ==========================================
async function fetchCollections() {
  const list = document.getElementById('collectionList');
  list.innerText = 'Loading...';
  const data = await callHF('/api/collections');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(c => `<div class="list-item"><strong>${c.title}</strong><br><small>Slug: ${c.slug}</small></div>`).join('') || 'No collections.';
  } else { list.innerText = JSON.stringify(data); }
}

// ==========================================
// 7. DISCUSSIONS
// ==========================================
async function fetchDiscussions() {
  const repo = document.getElementById('discRepo').value;
  const list = document.getElementById('discussionList');
  if (!repo) { alert("Enter model ID first"); return; }
  list.innerText = 'Loading...';
  const data = await callHF(`/api/models/${repo}/discussions`);
  if (Array.isArray(data)) {
    list.innerHTML = data.map(d => `<div class="list-item"><strong>${d.title}</strong><br><small>By: ${d.author.name}</small></div>`).join('') || 'No discussions.';
  } else { list.innerText = JSON.stringify(data); }
}

// ==========================================
// 8. NOTIFICATIONS
// ==========================================
async function fetchNotifications() {
  const list = document.getElementById('notifList');
  list.innerText = 'Loading...';
  const data = await callHF('/api/notifications');
  if (Array.isArray(data)) {
    list.innerHTML = data.map(n => `<div class="list-item"><strong>${n.title || 'Notification'}</strong><br><small>${n.read ? '✅ Read' : '🔴 Unread'}</small></div>`).join('') || 'Inbox clean!';
  } else { list.innerText = JSON.stringify(data); }
}

// ==========================================
// 9. BILLING
// ==========================================
async function fetchBilling() {
  const result = document.getElementById('billingResult');
  result.innerText = 'Loading...';
  const data = await callHF('/api/billing');
  result.innerText = JSON.stringify(data, null, 2);
}