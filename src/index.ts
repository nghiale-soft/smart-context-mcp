import { loadConfig } from './config/index.js';
import { StorageManager } from './storage/db.js';
import { SmartContextMcpServer } from './mcp/server.js';
import { startDashboardServer } from './dashboard/server.js';

async function main() {
  const config = loadConfig();
  console.error(`[SmartContext] Starting Smart Context MCP Server...`);
  console.error(`[SmartContext] Cache Database Path: ${config.cacheDbPath}`);

  // Initialize SQLite Storage
  const storage = new StorageManager(config.cacheDbPath);

  // Start Local Web Dashboard if enabled
  if (config.enableDashboard) {
    startDashboardServer(config, storage);
  }

  // Start MCP Server on stdio
  const mcpServer = new SmartContextMcpServer(config, storage);
  await mcpServer.start();
}

main().catch((err) => {
  console.error('[SmartContext] Fatal error during startup:', err);
  process.exit(1);
});
