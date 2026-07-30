import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { StorageManager } from '../storage/db.js';
import { getGitDelta } from '../scanner/git.js';
import { TreeSitterScanner } from '../scanner/tree-sitter.js';
import { SmartContextConfig } from '../config/index.js';
import fs from 'fs';
import path from 'path';

export class SmartContextMcpServer {
  private server: Server;
  private storage: StorageManager;
  private treeSitter: TreeSitterScanner;
  private config: SmartContextConfig;

  constructor(config: SmartContextConfig, storage: StorageManager) {
    this.config = config;
    this.storage = storage;
    this.treeSitter = new TreeSitterScanner();

    this.server = new Server(
      {
        name: 'smart-context-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available MCP Prompts (Slash Commands)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'smart_context',
            description: 'Tự động phân tích intent bằng Low AI, lấy Git Delta và trích xuất AST symbol làm ngữ cảnh tối ưu.',
            arguments: [
              {
                name: 'prompt',
                description: 'Câu hỏi hoặc yêu cầu lập trình của bạn.',
                required: true,
              },
            ],
          },
        ],
      };
    });

    // Handle Get Prompt Request (When client calls slash command)
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (name === 'smart_context') {
        const userPrompt = (args?.prompt as string) || '';
        const workspacePath = process.cwd();
        const context = await this.buildOptimizedContext(userPrompt, workspacePath);

        return {
          description: `Smart Context optimized prompt: "${userPrompt}"`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `${context}\n\nYêu cầu chính:\n${userPrompt}`,
              },
            },
          ],
        };
      }
      throw new Error(`Prompt not found: ${name}`);
    });

    // List available MCP Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_optimized_context',
            description: 'Lấy ngữ cảnh mã nguồn đã được lọc và tối ưu hóa dựa trên prompt yêu cầu của người dùng.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Yêu cầu lập trình hoặc câu hỏi của người dùng.',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Đường dẫn tuyệt đối tới workspace repository.',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'scan_workspace',
            description: 'Quét và lập chỉ mục (Index) toàn bộ mã nguồn vào SQLite Database.',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: 'Đường dẫn tuyệt đối tới workspace repository.',
                },
              },
              required: ['workspacePath'],
            },
          },
          {
            name: 'get_repo_map',
            description: 'Lấy bản đồ phân cấp file và danh sách các Symbol chính trong dự án.',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: 'Đường dẫn tuyệt đối tới workspace repository.',
                },
              },
            },
          },
        ],
      };
    });

    // Handle MCP Tool Calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const workspacePath = (args?.workspacePath as string) || process.cwd();

      if (name === 'scan_workspace') {
        const result = await this.scanWorkspace(workspacePath);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      if (name === 'get_repo_map') {
        const result = this.getRepoMap(workspacePath);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      if (name === 'get_optimized_context') {
        const prompt = (args?.prompt as string) || '';
        const context = await this.buildOptimizedContext(prompt, workspacePath);
        return {
          content: [
            {
              type: 'text',
              text: context,
            },
          ],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  private async scanWorkspace(workspacePath: string) {
    await this.treeSitter.init();
    const gitDelta = getGitDelta(workspacePath);
    const db = this.storage.getDb();

    let scannedFiles = 0;
    let totalSymbols = 0;

    const projectName = path.basename(workspacePath) || 'smart-context-mcp';

    const readFilesRecursively = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(workspacePath, fullPath);

        if (entry.isDirectory()) {
          readFilesRecursively(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|rs|java)$/i.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const mtime = fs.statSync(fullPath).mtimeMs;
          
          // Select or Insert file into DB
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
            // Extract & save symbols
            const symbols = this.treeSitter.parseFileSymbols(relPath, content);
            const deleteStmt = db.prepare('DELETE FROM symbols WHERE file_id = ?');
            deleteStmt.run(fileId);

            const insertSymbol = db.prepare(`
              INSERT INTO symbols (file_id, name, kind, start_line, end_line, signature)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const sym of symbols) {
              insertSymbol.run(fileId, sym.name, sym.kind, sym.startLine, sym.endLine, sym.signature || null);
              totalSymbols++;
            }
          }

          scannedFiles++;
        }
      }
    };

    readFilesRecursively(workspacePath);

    return {
      status: 'success',
      scannedFiles,
      totalSymbols,
      gitDelta,
    };
  }

  private getRepoMap(workspacePath: string): string {
    const db = this.storage.getDb();
    const rows = db.prepare(`
      SELECT f.file_path, s.name, s.kind, s.start_line
      FROM files f
      LEFT JOIN symbols s ON f.id = s.file_id
      ORDER BY f.file_path ASC, s.start_line ASC
    `).all() as any[];

    if (rows.length === 0) {
      return "Chưa có dữ liệu Repo Map. Vui lòng gọi tool 'scan_workspace' trước.";
    }

    let mapText = "# Smart Context Repo Map\n\n";
    let currentFile = "";

    for (const row of rows) {
      if (row.file_path !== currentFile) {
        currentFile = row.file_path;
        mapText += `\n📄 ${currentFile}\n`;
      }
      if (row.name) {
        mapText += `  ├── [${row.kind}] ${row.name} (L${row.start_line})\n`;
      }
    }

    return mapText;
  }

  private async buildOptimizedContext(prompt: string, workspacePath: string): Promise<string> {
    const { analyzeIntent } = await import('../ai/intent.js');
    const intentResult = await analyzeIntent(prompt, this.config);
    const gitDelta = getGitDelta(workspacePath);

    const estimatedTokens = Math.ceil((prompt.length + JSON.stringify(intentResult).length) / 4) + 15;
    const projectName = path.basename(workspacePath) || 'smart-context-mcp';
    this.storage.recordMetric(
      projectName,
      prompt,
      this.config.lowAiModel || '',
      estimatedTokens,
      intentResult.keywords ? intentResult.keywords.length : 0
    );

    let output = `## Context được Tối ưu hóa bởi Smart Context MCP\n\n`;
    output += `### 🎯 Ý định Prompt: "${prompt}"\n`;
    output += `🤖 **Phân tích Low AI (${this.config.lowAiModel}):** ${intentResult.summary}\n\n`;

    if (gitDelta.isGitRepo && (gitDelta.modifiedFiles.length > 0 || gitDelta.stagedFiles.length > 0)) {
      output += `### ⚡ Files đang Chỉnh sửa (Git Delta - Trọng tâm KEEP):\n`;
      for (const f of [...gitDelta.stagedFiles, ...gitDelta.modifiedFiles]) {
        output += `- 📝 \`${f}\`\n`;
      }
      output += `\n`;
    }

    output += `### 🗺️ Bản đồ Cấu trúc Repo & Symbols:\n`;
    output += this.getRepoMap(workspacePath);

    return output;
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[SmartContextMCP] MCP Server started listening on stdio transport.');
  }
}
