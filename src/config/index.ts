import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

export interface SmartContextConfig {
  lowAiProvider: string; // 'anthropic' | 'openai' | 'gemini' | 'groq' | 'ollama'
  lowAiApiKey: string;
  lowAiModel: string;
  lowAiBaseUrl: string;
  lowAiAuthToken: string;
  cacheDbPath: string;
  dashboardPort: number;
  enableDashboard: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.smart-context');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): SmartContextConfig {
  let fileConfig: Partial<SmartContextConfig> = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      console.error(`[Config] Failed to parse ${CONFIG_FILE}:`, err);
    }
  }

  const defaultDbPath = path.join(CONFIG_DIR, 'cache.db');

  return {
    lowAiProvider: process.env.LOW_AI_PROVIDER || fileConfig.lowAiProvider || 'anthropic',
    lowAiApiKey: process.env.LOW_AI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || fileConfig.lowAiApiKey || '',
    lowAiModel: process.env.LOW_AI_MODEL || process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || fileConfig.lowAiModel || '',
    lowAiBaseUrl: process.env.LOW_AI_BASE_URL || process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_BASE_URL || fileConfig.lowAiBaseUrl || '',
    lowAiAuthToken: process.env.LOW_AI_AUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN || fileConfig.lowAiAuthToken || '',
    cacheDbPath: process.env.CACHE_DB_PATH || fileConfig.cacheDbPath || defaultDbPath,
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || `${fileConfig.dashboardPort || 3333}`, 10),
    enableDashboard: process.env.ENABLE_DASHBOARD !== 'false' && (fileConfig.enableDashboard !== false),
  };
}

export function saveConfig(updates: Partial<SmartContextConfig>): SmartContextConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = loadConfig();
  const updated = { ...current, ...updates };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
