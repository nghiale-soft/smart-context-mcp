import express from 'express';
import cors from 'cors';
import { SmartContextConfig, saveConfig, loadConfig } from '../config/index.js';
import { StorageManager } from '../storage/db.js';
import { analyzeIntent } from '../ai/intent.js';

export function startDashboardServer(config: SmartContextConfig, storage: StorageManager) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Config
  app.get('/api/config', (req, res) => {
    const current = loadConfig();
    res.json(current);
  });

  app.post('/api/config', (req, res) => {
    try {
      const updated = saveConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Get Distinct Projects
  app.get('/api/projects', (req, res) => {
    const db = storage.getDb();
    const projects = db.prepare('SELECT DISTINCT project_name FROM files ORDER BY project_name ASC').all();
    res.json(projects.map((p: any) => p.project_name));
  });

  // API Detailed Cache Files with Project Filter
  app.get('/api/cache/files', (req, res) => {
    const db = storage.getDb();
    const projectFilter = req.query.project as string;
    
    let query = `
      SELECT f.id, f.project_name, f.file_path, f.language, f.updated_at, COUNT(s.id) as symbol_count
      FROM files f
      LEFT JOIN symbols s ON f.id = s.file_id
    `;
    const params: any[] = [];

    if (projectFilter && projectFilter !== 'all') {
      query += ` WHERE f.project_name = ?`;
      params.push(projectFilter);
    }

    query += ` GROUP BY f.id ORDER BY f.project_name ASC, f.file_path ASC LIMIT 200`;
    const files = db.prepare(query).all(...params);
    res.json(files);
  });

  // API Detailed Cache Symbols with Project Filter
  app.get('/api/cache/symbols', (req, res) => {
    const db = storage.getDb();
    const projectFilter = req.query.project as string;

    let query = `
      SELECT s.id, s.name, s.kind, s.start_line, f.file_path, f.project_name
      FROM symbols s
      JOIN files f ON s.file_id = f.id
    `;
    const params: any[] = [];

    if (projectFilter && projectFilter !== 'all') {
      query += ` WHERE f.project_name = ?`;
      params.push(projectFilter);
    }

    query += ` ORDER BY s.id DESC LIMIT 200`;
    const symbols = db.prepare(query).all(...params);
    res.json(symbols);
  });

  // API Detailed KPI Stats with Project Filter
  app.get('/api/stats', (req, res) => {
    const db = storage.getDb();
    const currentConfig = loadConfig();
    const projectFilter = req.query.project as string;

    let fileCount = 0;
    let symbolCount = 0;
    let totalPrompts = 0;
    let totalTokens = 0;

    if (projectFilter && projectFilter !== 'all') {
      fileCount = (db.prepare('SELECT COUNT(*) as count FROM files WHERE project_name = ?').get(projectFilter) as any)?.count || 0;
      symbolCount = (db.prepare('SELECT COUNT(s.id) as count FROM symbols s JOIN files f ON s.file_id = f.id WHERE f.project_name = ?').get(projectFilter) as any)?.count || 0;
      totalPrompts = (db.prepare('SELECT COUNT(*) as count FROM metrics WHERE project_name = ?').get(projectFilter) as any)?.count || 0;
      totalTokens = (db.prepare('SELECT SUM(tokens_processed) as total FROM metrics WHERE project_name = ?').get(projectFilter) as any)?.total || 0;
    } else {
      fileCount = (db.prepare('SELECT COUNT(*) as count FROM files').get() as any)?.count || 0;
      symbolCount = (db.prepare('SELECT COUNT(*) as count FROM symbols').get() as any)?.count || 0;
      totalPrompts = (db.prepare('SELECT COUNT(*) as count FROM metrics').get() as any)?.count || 0;
      totalTokens = (db.prepare('SELECT SUM(tokens_processed) as total FROM metrics').get() as any)?.total || 0;
    }

    res.json({
      fileCount,
      symbolCount,
      totalPrompts,
      totalTokens,
      dbPath: currentConfig.cacheDbPath,
      activeConfig: currentConfig,
    });
  });

  // API Test Low AI Prompt Simulation
  app.post('/api/test-prompt', async (req, res) => {
    try {
      const { prompt, project } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' });
      }

      const projectName = project || 'smart-context-mcp';
      const currentConfig = loadConfig();
      const result = await analyzeIntent(prompt, currentConfig);
      
      // Calculate token count and record metric into SQLite
      const estimatedTokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4) + 15;
      storage.recordMetric(prompt, projectName, estimatedTokens);

      res.json({
        success: true,
        result,
        tokensUsed: estimatedTokens,
        projectName
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 100% English Glassmorphism Dashboard with Detailed Tooltips & Low AI Simulator
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Context MCP — Universal Dashboard</title>
        <style>
          :root {
            --bg-color: #0b0f19;
            --card-bg: #161e2e;
            --primary: #38bdf8;
            --accent: #818cf8;
            --success: #34d399;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --border: rgba(255, 255, 255, 0.08);
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-color);
            color: var(--text);
            margin: 0;
            padding: 2rem;
          }
          .container {
            max-width: 1100px;
            margin: 0 auto;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1rem;
          }
          h1 {
            color: var(--primary);
            font-size: 1.8rem;
            margin: 0;
          }
          .subtitle {
            color: var(--text-muted);
            font-size: 0.9rem;
            margin-top: 0.25rem;
          }
          .header-actions {
            display: flex;
            align-items: center;
            gap: 0.6rem;
          }
          .project-select-box {
            display: flex;
            align-items: center;
            gap: 0.35rem;
            background: var(--card-bg);
            border: 1px solid var(--border);
            padding: 0.3rem 0.65rem;
            border-radius: 8px;
            max-width: 210px;
          }
          .project-select-box label {
            font-size: 0.78rem;
            color: var(--text-muted);
            margin: 0;
            white-space: nowrap;
          }
          .project-select-box select {
            background: transparent;
            border: none;
            color: var(--primary);
            font-weight: 600;
            font-size: 0.82rem;
            padding: 0.1rem;
            cursor: pointer;
            outline: none;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          }
          .header-btn {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text);
            border: 1px solid var(--border);
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.35rem;
            transition: all 0.2s ease;
          }
          .header-btn:hover {
            background: rgba(56, 189, 248, 0.15);
            border-color: var(--primary);
            color: var(--primary);
          }
          .badge {
            background: rgba(52, 211, 153, 0.15);
            color: var(--success);
            padding: 0.4rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.78rem;
            font-weight: 600;
          }
          .grid-4 {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.25rem;
            text-align: center;
            position: relative;
          }
          .stat-val {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 0.25rem;
          }
          .stat-lbl {
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }
          .card h2 {
            font-size: 1.15rem;
            margin-top: 0;
            margin-bottom: 1rem;
            color: #e2e8f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
          }
          th, td {
            padding: 0.65rem 0.8rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
          }
          th {
            color: var(--text-muted);
            font-weight: 600;
          }
          tr:hover {
            background: rgba(255, 255, 255, 0.02);
          }
          .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }
          .tab-btn {
            background: transparent;
            color: var(--text-muted);
            border: 1px solid var(--border);
            padding: 0.4rem 1rem;
            border-radius: 6px;
            font-size: 0.85rem;
            cursor: pointer;
          }
          .tab-btn.active {
            background: var(--primary);
            color: #000;
            border-color: var(--primary);
          }
          /* Comprehensive Multi-line Tooltip Styles */
          .tooltip-icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            line-height: 16px;
            text-align: center;
            border-radius: 50%;
            background: rgba(56, 189, 248, 0.15);
            color: var(--primary);
            font-size: 0.72rem;
            font-weight: bold;
            margin-left: 0.35rem;
            cursor: help;
            position: relative;
          }
          .tooltip-icon:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 130%;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: #f8fafc;
            padding: 0.6rem 0.88rem;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: 400;
            line-height: 1.45;
            width: max-content;
            max-width: 290px;
            white-space: normal;
            text-align: left;
            box-shadow: 0 12px 30px rgba(0,0,0,0.8);
            border: 1px solid var(--border);
            z-index: 99999;
            pointer-events: none;
          }
          /* Modal Dialog Overlay */
          .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 2000;
            justify-content: center;
            align-items: center;
          }
          .modal-overlay.active {
            display: flex;
          }
          .modal-card {
            background: #111827;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 2rem;
            width: 100%;
            max-width: 620px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);
            max-height: 85vh;
            overflow-y: visible;
            position: relative;
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.75rem;
          }
          .modal-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: var(--primary);
          }
          .close-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 1.5rem;
            cursor: pointer;
          }
          .form-group {
            margin-bottom: 1.2rem;
          }
          label {
            display: flex;
            align-items: center;
            margin-bottom: 0.4rem;
            font-size: 0.85rem;
            color: var(--text-muted);
          }
          input, select, textarea {
            width: 100%;
            padding: 0.75rem;
            background: #0b0f19;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #fff;
            box-sizing: border-box;
            font-size: 0.9rem;
            font-family: inherit;
          }
          .btn-primary {
            background: var(--primary);
            color: #000;
            font-weight: bold;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
          }
          .guide-section {
            margin-bottom: 1.25rem;
          }
          .guide-section h3 {
            color: var(--primary);
            font-size: 1rem;
            margin-top: 0;
            margin-bottom: 0.4rem;
          }
          .guide-section p, .guide-section ul {
            font-size: 0.88rem;
            color: var(--text-muted);
            line-height: 1.5;
            margin: 0 0 0.5rem 0;
          }
          .guide-section ul {
            padding-left: 1.2rem;
          }
          code {
            background: rgba(255,255,255,0.08);
            color: var(--primary);
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            font-size: 0.82rem;
          }
          .result-box {
            background: #0b0f19;
            border: 1px solid var(--border);
            padding: 1rem;
            border-radius: 8px;
            margin-top: 1rem;
            font-size: 0.85rem;
            max-height: 180px;
            overflow-y: auto;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div>
              <h1>🧠 Smart Context MCP Server</h1>
              <div class="subtitle">Universal Context Engine & Local SQLite Explorer</div>
            </div>
            <div class="header-actions">
              <div class="project-select-box">
                <label>Project:</label>
                <select id="projectSelect" onchange="onProjectChange()">
                  <option value="all">All Projects</option>
                </select>
              </div>
              <button class="header-btn" onclick="openModal('testModal')">🧪 Test Low AI</button>
              <button class="header-btn" onclick="openModal('settingsModal')">⚙️ Settings</button>
              <button class="header-btn" onclick="openModal('guideModal')">❓ Guide</button>
              <span class="badge">Online</span>
            </div>
          </header>

          <!-- KPI Metrics Grid with Tooltips -->
          <div class="grid-4">
            <div class="stat-card">
              <div class="stat-val" id="fileCount">-</div>
              <div class="stat-lbl">
                Cached Files
                <span class="tooltip-icon" data-tooltip="Total source code files scanned across your repository workspace and cached in local SQLite database.">?</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-val" id="symbolCount">-</div>
              <div class="stat-lbl">
                Parsed Symbols
                <span class="tooltip-icon" data-tooltip="Total functions, classes, methods, interfaces, and types extracted from source code AST using Tree-sitter parsing.">?</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-val" id="totalPrompts">-</div>
              <div class="stat-lbl">
                Filtered Prompts
                <span class="tooltip-icon" data-tooltip="Number of user prompts processed by Low AI intent analyzer to extract relevant code context. Increments when AI Agent calls MCP get_smart_context or via Test Low AI.">?</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-val" id="totalTokens">-</div>
              <div class="stat-lbl">
                Low AI Tokens
                <span class="tooltip-icon" data-tooltip="Total token usage consumed by cheap/fast Low AI model during prompt intent and keyword analysis. Recorded live in SQLite database.">?</span>
              </div>
            </div>
          </div>

          <!-- SQLite Cache Explorer -->
          <div class="card">
            <h2>📦 SQLite Local Cache Explorer</h2>
            <div class="tabs">
              <button class="tab-btn active" id="tabFiles" onclick="switchTab('files')">Files Cache</button>
              <button class="tab-btn" id="tabSymbols" onclick="switchTab('symbols')">Symbols AST</button>
            </div>
            
            <!-- Files Table -->
            <div id="filesView">
              <table>
                <thead>
                  <tr>
                    <th>ID <span class="tooltip-icon" data-tooltip="Unique index ID generated by SQLite for this cached file record. Used internally for fast relational joins.">?</span></th>
                    <th>Project <span class="tooltip-icon" data-tooltip="The repository workspace name where this source file belongs. Enables multi-project workspace index management.">?</span></th>
                    <th>File Path <span class="tooltip-icon" data-tooltip="Relative file path from project root. Used by Context Builder to pull exact source code blocks.">?</span></th>
                    <th>Language <span class="tooltip-icon" data-tooltip="Source programming language detected by file extension (TypeScript, Python, Go, Rust, Java...)">?</span></th>
                    <th>Symbols <span class="tooltip-icon" data-tooltip="Total AST code symbols (functions, classes, methods, interfaces) extracted by Tree-sitter parser for this file.">?</span></th>
                  </tr>
                </thead>
                <tbody id="filesTableBody">
                  <tr><td colspan="5">Loading SQLite cached files...</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Symbols Table -->
            <div id="symbolsView" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Symbol Name <span class="tooltip-icon" data-tooltip="The exact identifier name of the function, class, method, or interface extracted from source code AST.">?</span></th>
                    <th>Kind <span class="tooltip-icon" data-tooltip="AST Symbol category (class, function, interface, variable, type) used by Ranking Engine to filter relevant context.">?</span></th>
                    <th>Line <span class="tooltip-icon" data-tooltip="Exact line number in the source file where this symbol definition begins.">?</span></th>
                    <th>File Path <span class="tooltip-icon" data-tooltip="Relative file path containing this symbol definition.">?</span></th>
                    <th>Project <span class="tooltip-icon" data-tooltip="Target repository project workspace name containing this symbol.">?</span></th>
                  </tr>
                </thead>
                <tbody id="symbolsTableBody">
                  <tr><td colspan="5">Loading SQLite AST symbols...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 🧪 Test Low AI Modal Dialog -->
        <div class="modal-overlay" id="testModal">
          <div class="modal-card">
            <div class="modal-header">
              <h2>🧪 Test Low AI Intent Analysis</h2>
              <button class="close-btn" onclick="closeModal('testModal')">&times;</button>
            </div>
            <form id="testForm">
              <div class="form-group">
                <label>Sample User Coding Prompt <span class="tooltip-icon" data-tooltip="Enter any coding request to test how the Low AI Model analyzes user intent and extracts target symbols.">?</span></label>
                <textarea id="testPromptInput" rows="3" placeholder="e.g. Refactor database connection pool and fix SQL query performance in src/storage/db.ts"></textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                <button type="button" class="tab-btn" onclick="closeModal('testModal')">Cancel</button>
                <button type="submit" class="btn-primary">Analyze Prompt</button>
              </div>
            </form>
            <div id="testResultBox" class="result-box" style="display: none;"></div>
          </div>
        </div>

        <!-- ⚙️ Settings Modal Dialog -->
        <div class="modal-overlay" id="settingsModal">
          <div class="modal-card">
            <div class="modal-header">
              <h2>⚙️ Global Low AI & Provider Configuration</h2>
              <button class="close-btn" onclick="closeModal('settingsModal')">&times;</button>
            </div>
            <form id="configForm">
              <div class="form-group">
                <label>Low AI Provider <span class="tooltip-icon" data-tooltip="Select the cheap/fast AI service (local Ollama, Groq, Claude, Gemini) used to analyze user intent without wasting main LLM tokens.">?</span></label>
                <select id="lowAiProvider">
                  <option value="anthropic">Anthropic (Claude API / Ollama Local)</option>
                  <option value="openai">OpenAI (Codex / GPT-4o)</option>
                  <option value="groq">Groq Cloud (Llama 3.3 70B)</option>
                  <option value="gemini">Google Gemini Flash</option>
                </select>
              </div>
              <div class="form-group">
                <label>Low AI Model Name <span class="tooltip-icon" data-tooltip="The model identifier name to invoke for prompt intent analysis (e.g. nemotron-3-super:cloud, llama-3.3-70b-versatile, claude-3-5-sonnet).">?</span></label>
                <input type="text" id="lowAiModel" placeholder="nemotron-3-super:cloud / llama-3.3-70b-versatile" />
              </div>
              <div class="form-group">
                <label>Low AI Base URL <span class="tooltip-icon" data-tooltip="Base HTTP endpoint URL for the Low AI API service (e.g. http://localhost:11434 for local Ollama, https://api.groq.com/openai for Groq).">?</span></label>
                <input type="text" id="lowAiBaseUrl" placeholder="http://localhost:11434 or https://api.anthropic.com" />
              </div>
              <div class="form-group">
                <label>Low AI Auth Token / API Key <span class="tooltip-icon" data-tooltip="Authorization Bearer token or API Key required to authenticate requests to the Low AI endpoint.">?</span></label>
                <input type="password" id="lowAiApiKey" placeholder="ollama / gsk_... / sk-..." />
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                <button type="button" class="tab-btn" onclick="closeModal('settingsModal')">Cancel</button>
                <button type="submit" class="btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>

        <!-- ❓ User Guide Modal Dialog -->
        <div class="modal-overlay" id="guideModal">
          <div class="modal-card">
            <div class="modal-header">
              <h2>❓ Smart Context MCP — Dashboard User Guide</h2>
              <button class="close-btn" onclick="closeModal('guideModal')">&times;</button>
            </div>
            
            <div class="guide-section">
              <h3>🚀 What is Smart Context MCP?</h3>
              <p>Smart Context MCP is a local Universal Context Engine running as a Model Context Protocol (MCP) server. It reduces main LLM token consumption by 50%–70% by extracting only relevant code AST symbols and workspace Git Delta changes.</p>
            </div>

            <div class="guide-section">
              <h3>🤖 How Low AI Provider Works</h3>
              <p>When an AI Coding Agent makes a prompt request, Smart Context MCP routes the prompt through a cheap/fast <b>Low AI Model</b> (e.g., local Ollama Nemotron, Groq, or Gemini Flash) to analyze user intent and extract target code keywords without wasting expensive main LLM tokens.</p>
            </div>

            <div class="guide-section">
              <h3>📦 SQLite Local Cache Explorer</h3>
              <ul>
                <li><b>Files Cache:</b> Shows all repository source files scanned and stored locally in SQLite (<code>cache.db</code>).</li>
                <li><b>Symbols AST:</b> Displays all functions, classes, methods, interfaces, and types extracted via Tree-sitter parsing.</li>
                <li><b>Project Selector:</b> Use the top-right dropdown to filter statistics and SQLite cache tables by specific project workspaces.</li>
              </ul>
            </div>

            <div class="guide-section">
              <h3>🔌 MCP Client Configuration</h3>
              <p>Add the following server config to your AI Client (<code>mcp_settings.json</code>):</p>
              <pre><code>{
  "mcpServers": {
    "smart-context": {
      "command": "/path/to/unzipped/smart-context-mcp-release/smart-context-mcp",
      "args": []
    }
  }
}</code></pre>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
              <button type="button" class="btn-primary" onclick="closeModal('guideModal')">Got it!</button>
            </div>
          </div>
        </div>

        <script>
          let currentProject = 'all';

          function openModal(id) {
            document.getElementById(id).classList.add('active');
          }

          function closeModal(id) {
            document.getElementById(id).classList.remove('active');
          }

          async function loadProjects() {
            const res = await fetch('/api/projects');
            const projects = await res.json();
            const select = document.getElementById('projectSelect');
            select.innerHTML = '<option value="all">All Projects</option>';
            projects.forEach(p => {
              const opt = document.createElement('option');
              opt.value = p;
              opt.innerText = p;
              select.appendChild(opt);
            });
            if (projects.length > 0) {
              select.value = projects[0];
              currentProject = projects[0];
            }
          }

          async function loadStats() {
            const res = await fetch('/api/stats?project=' + encodeURIComponent(currentProject));
            const data = await res.json();
            document.getElementById('fileCount').innerText = data.fileCount;
            document.getElementById('symbolCount').innerText = data.symbolCount;
            document.getElementById('totalPrompts').innerText = data.totalPrompts;
            document.getElementById('totalTokens').innerText = data.totalTokens;
          }

          async function loadConfig() {
            const res = await fetch('/api/config');
            const data = await res.json();
            document.getElementById('lowAiProvider').value = data.lowAiProvider || 'anthropic';
            document.getElementById('lowAiModel').value = data.lowAiModel || '';
            document.getElementById('lowAiBaseUrl').value = data.lowAiBaseUrl || '';
            document.getElementById('lowAiApiKey').value = data.lowAiApiKey || '';
          }

          async function loadFiles() {
            const res = await fetch('/api/cache/files?project=' + encodeURIComponent(currentProject));
            const files = await res.json();
            const tbody = document.getElementById('filesTableBody');
            if (files.length === 0) {
              tbody.innerHTML = '<tr><td colspan="5">No cached files found. Call MCP tool scan_workspace.</td></tr>';
              return;
            }
            tbody.innerHTML = files.map(f => \`
              <tr>
                <td>\${f.id}</td>
                <td><span style="color: var(--accent); font-weight:600">\${f.project_name || 'smart-context-mcp'}</span></td>
                <td><code>\${f.file_path}</code></td>
                <td>\${f.language}</td>
                <td><b>\${f.symbol_count}</b></td>
              </tr>
            \`).join('');
          }

          async function loadSymbols() {
            const res = await fetch('/api/cache/symbols?project=' + encodeURIComponent(currentProject));
            const symbols = await res.json();
            const tbody = document.getElementById('symbolsTableBody');
            if (symbols.length === 0) {
              tbody.innerHTML = '<tr><td colspan="5">No AST symbols found in cache.</td></tr>';
              return;
            }
            tbody.innerHTML = symbols.map(s => \`
              <tr>
                <td><b>\${s.name}</b></td>
                <td><span style="color: var(--primary)">[\${s.kind}]</span></td>
                <td>L\${s.start_line}</td>
                <td><code>\${s.file_path}</code></td>
                <td><span style="color: var(--accent)">\${s.project_name || 'smart-context-mcp'}</span></td>
              </tr>
            \`).join('');
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

          document.getElementById('configForm').addEventListener('submit', async (e) => {
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

          document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const prompt = document.getElementById('testPromptInput').value;
            const resultBox = document.getElementById('testResultBox');
            resultBox.style.display = 'block';
            resultBox.innerText = 'Analyzing prompt with Low AI model...';

            try {
              const res = await fetch('/api/test-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt,
                  project: currentProject === 'all' ? 'smart-context-mcp' : currentProject
                })
              });
              const data = await res.json();
              if (data.success) {
                resultBox.innerText = '✅ Analysis Result:\n' + JSON.stringify(data.result, null, 2) + '\n\nTokens Used: ' + data.tokensUsed;
                loadStats();
              } else {
                resultBox.innerText = '❌ Error: ' + data.error;
              }
            } catch (err) {
              resultBox.innerText = '❌ Request failed: ' + err.message;
            }
          });

          async function init() {
            await loadProjects();
            loadStats();
            loadConfig();
            loadFiles();
            loadSymbols();
          }

          init();
        </script>
      </body>
      </html>
    `);
  });

  const server = app.listen(config.dashboardPort, () => {
    console.error(`[Dashboard] Web Dashboard UI is running at http://localhost:${config.dashboardPort}`);
  });

  return server;
}
