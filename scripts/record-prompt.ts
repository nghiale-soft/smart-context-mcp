import { StorageManager } from '../src/storage/db.js';
import { loadConfig } from '../src/config/index.js';
import path from 'path';

async function run() {
  const workspacePath = process.argv[2] || process.cwd();
  const promptText = process.argv[3] || 'User programming prompt';
  const tokens = parseInt(process.argv[4] || '50', 10);
  const symbols = parseInt(process.argv[5] || '0', 10);

  const projectName = path.basename(workspacePath);
  const config = loadConfig();
  const storage = new StorageManager(config.cacheDbPath);

  storage.recordMetric(projectName, promptText, config.lowAiModel || 'nemotron-3-super:cloud', tokens, symbols);
  console.log(`Recorded prompt metric for project [${projectName}]: "${promptText}" (${tokens} tokens)`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
