import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartContextConfig, saveConfig, loadConfig } from '../config/index.js';
import { StorageManager } from '../storage/db.js';
import { analyzeIntent } from '../ai/intent.js';
import { safeFetch } from '../utils/fetch.js';

export function startDashboardServer(config: SmartContextConfig, storage: StorageManager) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const staticPath = path.join(__dirname, 'static');
  app.use(express.static(staticPath, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));

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
    const projects = db.prepare('SELECT DISTINCT project_name FROM files WHERE project_name IS NOT NULL ORDER BY project_name ASC').all();
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

  // API Test Low AI Prompt Simulation & Connection Test
  app.post('/api/test-prompt', async (req, res) => {
    try {
      const { prompt, project, configOverride } = req.body;
      const testPrompt = prompt || 'Test connection intent analysis';

      const projectName = (project && project !== 'all') ? project : 'smart-context-mcp';
      const currentConfig = configOverride ? { ...loadConfig(), ...configOverride } : loadConfig();
      const result = await analyzeIntent(testPrompt, currentConfig);
      
      // Calculate token count and record metric into SQLite
      const estimatedTokens = Math.ceil((testPrompt.length + JSON.stringify(result).length) / 4) + 15;
      storage.recordMetric(
        projectName,
        testPrompt,
        currentConfig.lowAiModel || '',
        estimatedTokens,
        result.keywords ? result.keywords.length : 0
      );

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

  // API Lightweight Connection Health Check (No LLM prompt, no token cost)
  app.post('/api/test-connection', async (req, res) => {
    try {
      const { lowAiBaseUrl } = req.body;
      if (!lowAiBaseUrl) {
        return res.status(400).json({ success: false, error: 'Base URL is required' });
      }

      try {
        new URL(lowAiBaseUrl);
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid URL format' });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const response = await safeFetch(lowAiBaseUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        res.json({
          success: true,
          message: `Endpoint reachable (HTTP Status: ${response.status} ${response.statusText})`
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          return res.status(504).json({ success: false, error: 'Connection timed out after 4 seconds' });
        }
        if (fetchErr.message && (fetchErr.message.includes('fetch failed') || fetchErr.message.includes('ECONNREFUSED') || fetchErr.message.includes('ENOTFOUND'))) {
          return res.status(502).json({ success: false, error: `Connection refused or host unreachable` });
        }
        res.json({
          success: true,
          message: `Endpoint responded: ${fetchErr.message || 'online'}`
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

const server = app.listen(config.dashboardPort, () => {
    console.error(`[Dashboard] Web Dashboard UI is running at http://localhost:${config.dashboardPort}`);
  });

  return server;
}
