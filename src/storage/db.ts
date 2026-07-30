import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class StorageManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT DEFAULT 'smart-context-mcp',
        file_path TEXT NOT NULL,
        hash TEXT NOT NULL,
        last_modified INTEGER NOT NULL,
        language TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        signature TEXT,
        docstring TEXT,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_symbol_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbol_file ON symbols(file_id);

      CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file_id INTEGER NOT NULL,
        target_file_id INTEGER NOT NULL,
        imported_symbol TEXT,
        FOREIGN KEY(source_file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY(target_file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT DEFAULT 'smart-context-mcp',
        prompt TEXT NOT NULL,
        low_ai_model TEXT NOT NULL,
        tokens_processed INTEGER DEFAULT 0,
        symbols_matched INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-migration for existing databases
    try {
      const fileColumns = this.db.prepare("PRAGMA table_info(files)").all() as any[];
      const hasProjectName = fileColumns.some((col: any) => col.name === 'project_name');
      if (!hasProjectName) {
        this.db.exec("ALTER TABLE files ADD COLUMN project_name TEXT DEFAULT 'smart-context-mcp'");
      }
    } catch (err) {
      // Ignore migration errors
    }

    try {
      const metricColumns = this.db.prepare("PRAGMA table_info(metrics)").all() as any[];
      const hasMetricProject = metricColumns.some((col: any) => col.name === 'project_name');
      if (!hasMetricProject) {
        this.db.exec("ALTER TABLE metrics ADD COLUMN project_name TEXT DEFAULT 'smart-context-mcp'");
      }
    } catch (err) {
      // Ignore migration errors
    }
  }

  public recordMetric(projectName: string, prompt: string, model: string, tokens: number, symbolsMatched: number) {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (project_name, prompt, low_ai_model, tokens_processed, symbols_matched)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(projectName, prompt, model, tokens, symbolsMatched);
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close() {
    this.db.close();
  }
}
