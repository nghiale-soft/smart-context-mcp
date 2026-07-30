import { loadConfig } from '../src/config/index.js';
import { StorageManager } from '../src/storage/db.js';
import { SmartContextMcpServer } from '../src/mcp/server.js';
import path from 'path';

async function testRun() {
  const config = loadConfig();
  console.log('🧪 Testing Smart Context MCP Engine...');
  console.log(`📂 Cache Database: ${config.cacheDbPath}`);

  const storage = new StorageManager(config.cacheDbPath);
  const mcpServer = new SmartContextMcpServer(config, storage);
  const workspacePath = process.cwd();

  // 1. Test Scan Workspace
  console.log('\n--- 1. Quét & Lập chỉ mục Workspace (scan_workspace) ---');
  const scanResult = await (mcpServer as any).scanWorkspace(workspacePath);
  console.log('Kết quả scan:', JSON.stringify(scanResult, null, 2));

  // 2. Test Get Repo Map
  console.log('\n--- 2. Bản đồ Repo Map (get_repo_map) ---');
  const repoMap = (mcpServer as any).getRepoMap(workspacePath);
  console.log(repoMap);

  // 3. Test Optimized Context
  console.log('\n--- 3. Thử nghiệm Lọc Ngữ Cảnh (get_optimized_context) ---');
  const prompt = "Hãy giải thích cách hệ thống lưu trữ SQLite Cache và cách Intent Analyzer hoạt động";
  const context = await (mcpServer as any).buildOptimizedContext(prompt, workspacePath);
  console.log(context);

  storage.close();
  console.log('\n✅ Thử nghiệm hoàn tất! Bạn có thể reload http://localhost:3333 để thấy dữ liệu Cache!');
}

testRun().catch(console.error);
