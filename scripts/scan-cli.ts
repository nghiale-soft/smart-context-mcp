import { StorageManager } from '../src/storage/db.js';
import { TreeSitterScanner } from '../src/scanner/tree-sitter.js';
import { loadConfig } from '../src/config/index.js';
import fs from 'fs';
import path from 'path';

async function run() {
  const workspacePath = process.argv[2];
  if (!workspacePath) {
    console.error("Error: Please specify the absolute workspace path to scan.");
    console.log("Usage: npm run scan <workspace-path>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(workspacePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const config = loadConfig();
  const storage = new StorageManager(config.cacheDbPath);

  const scanner = new TreeSitterScanner();
  await scanner.init();

  const db = storage.getDb();
  const projectName = path.basename(resolvedPath);

  console.log(`🦉 Scanning codebase for project [${projectName}] at: ${resolvedPath}...`);

  let scannedFiles = 0;
  let totalSymbols = 0;

  const readFilesRecursively = (dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(resolvedPath, fullPath);

      if (entry.isDirectory()) {
        readFilesRecursively(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|rs|java)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const mtime = fs.statSync(fullPath).mtimeMs;
        
        const selectStmt = db.prepare('SELECT id FROM files WHERE project_name = ? AND file_path = ?');
        const existing = selectStmt.get(projectName, relPath) as any;
        let fileId: number;

        if (existing) {
          fileId = existing.id;
          db.prepare('UPDATE files SET last_modified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(Math.floor(mtime), fileId);
        } else {
          const insertStmt = db.prepare(`
            INSERT INTO files (project_name, file_path, hash, last_modified, language)
            VALUES (?, ?, ?, ?, ?)
          `);
          const info = insertStmt.run(projectName, relPath, 'hash_placeholder', Math.floor(mtime), path.extname(entry.name));
          fileId = Number(info.lastInsertRowid);
        }

        if (fileId) {
          scannedFiles++;
          const symbols = scanner.parseFileSymbols(relPath, content);
          const deleteStmt = db.prepare('DELETE FROM symbols WHERE file_id = ?');
          deleteStmt.run(fileId);

          const insertSymbol = db.prepare(`
            INSERT INTO symbols (file_id, name, kind, start_line, end_line, signature)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          for (const sym of symbols) {
            totalSymbols++;
            insertSymbol.run(fileId, sym.name, sym.kind, sym.startLine, sym.endLine, sym.signature || null);
          }
        }
      }
    }
  };

  readFilesRecursively(resolvedPath);
  console.log(`✅ Scan completed! Scanned ${scannedFiles} files, extracted ${totalSymbols} AST symbols.`);
}

run().catch(err => {
  console.error("Scan failed with error:", err);
  process.exit(1);
});
