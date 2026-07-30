var currentProject = 'all';

function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.classList.add('modal-open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.classList.remove('modal-open');
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const projects = await res.json();
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="all" selected>All Projects</option>';
    projects.forEach(function(p) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.innerText = p;
      select.appendChild(opt);
    });
    currentProject = 'all';
  } catch (err) {
    console.error('Error loading projects:', err);
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats?project=' + encodeURIComponent(currentProject));
    const data = await res.json();
    document.getElementById('fileCount').innerText = data.fileCount || 0;
    document.getElementById('symbolCount').innerText = data.symbolCount || 0;
    document.getElementById('totalPrompts').innerText = data.totalPrompts || 0;
    document.getElementById('totalTokens').innerText = data.totalTokens || 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    document.getElementById('lowAiProvider').value = data.lowAiProvider || 'anthropic';
    document.getElementById('lowAiModel').value = data.lowAiModel || '';
    document.getElementById('lowAiBaseUrl').value = data.lowAiBaseUrl || '';
    document.getElementById('lowAiApiKey').value = data.lowAiApiKey || '';
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

async function loadFiles() {
  try {
    const res = await fetch('/api/cache/files?project=' + encodeURIComponent(currentProject));
    const files = await res.json();
    const tbody = document.getElementById('filesTableBody');
    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No cached files found. Call MCP tool scan_workspace.</td></tr>';
      return;
    }
    tbody.innerHTML = files.map(function(f) {
      return '<tr>' +
        '<td>' + f.id + '</td>' +
        '<td><span style="color: var(--accent); font-weight:600">' + (f.project_name || 'smart-context-mcp') + '</span></td>' +
        '<td><code>' + f.file_path + '</code></td>' +
        '<td>' + f.language + '</td>' +
        '<td><b>' + f.symbol_count + '</b></td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    console.error('Error loading files:', err);
  }
}

async function loadSymbols() {
  try {
    const res = await fetch('/api/cache/symbols?project=' + encodeURIComponent(currentProject));
    const symbols = await res.json();
    const tbody = document.getElementById('symbolsTableBody');
    if (symbols.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No AST symbols found in cache.</td></tr>';
      return;
    }
    tbody.innerHTML = symbols.map(function(s) {
      return '<tr>' +
        '<td><b>' + s.name + '</b></td>' +
        '<td><span style="color: var(--primary)">[' + s.kind + ']</span></td>' +
        '<td>L' + s.start_line + '</td>' +
        '<td><code>' + s.file_path + '</code></td>' +
        '<td><span style="color: var(--accent)">' + (s.project_name || 'smart-context-mcp') + '</span></td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    console.error('Error loading symbols:', err);
  }
}

function onProjectChange() {
  currentProject = document.getElementById('projectSelect').value;
  loadStats();
  loadFiles();
  loadSymbols();
}

function switchTab(tab) {
  document.getElementById('tabFiles').classList.remove('active');
  document.getElementById('tabSymbols').classList.remove('active');
  if (tab === 'files') {
    document.getElementById('filesView').style.display = 'block';
    document.getElementById('symbolsView').style.display = 'none';
    document.getElementById('tabFiles').classList.add('active');
  } else {
    document.getElementById('filesView').style.display = 'none';
    document.getElementById('symbolsView').style.display = 'block';
    document.getElementById('tabSymbols').classList.add('active');
  }
}

async function testConnectionFromSettings() {
  const provider = document.getElementById('lowAiProvider').value;
  const model = document.getElementById('lowAiModel').value;
  const baseUrl = document.getElementById('lowAiBaseUrl').value;
  const apiKey = document.getElementById('lowAiApiKey').value;

  const resultBox = document.getElementById('settingsTestResult');
  resultBox.style.display = 'block';
  resultBox.innerText = '⚡ Testing connection to Low AI endpoint (' + (baseUrl || 'default') + ')...';

  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lowAiProvider: provider,
        lowAiModel: model,
        lowAiBaseUrl: baseUrl,
        lowAiApiKey: apiKey
      })
    });
    const data = await res.json();
    if (data.success) {
      resultBox.innerText = '✅ Connection Successful!\n' + data.message;
    } else {
      resultBox.innerText = '❌ Connection Error: ' + data.error;
    }
  } catch (err) {
    resultBox.innerText = '❌ Request failed: ' + err.message;
  }
}

document.getElementById('configForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const provider = document.getElementById('lowAiProvider').value;
  const model = document.getElementById('lowAiModel').value;
  const baseUrl = document.getElementById('lowAiBaseUrl').value;
  const apiKey = document.getElementById('lowAiApiKey').value;

  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lowAiProvider: provider,
      lowAiModel: model,
      lowAiBaseUrl: baseUrl,
      lowAiApiKey: apiKey
    })
  });

  alert('Configuration saved successfully!');
  closeModal('settingsModal');
  loadConfig();
});

async function init() {
  await loadProjects();
  loadStats();
  loadConfig();
  loadFiles();
  loadSymbols();
}

init();
