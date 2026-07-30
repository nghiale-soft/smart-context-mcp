# 🧠 Smart Context MCP Server

**Smart Context MCP** is a local Model Context Protocol (MCP) server acting as a **Universal Context Engine** for AI Coding Agents (Cline, Roo Code, Claude Code, Cursor, Continue.dev, Codex, etc.).

It reduces token consumption for powerful LLMs (Strong LLMs) by **50%–70%** by intelligently filtering code context, tracking Git Delta changes, and building high-performance local indexes using **SQLite** and **Tree-sitter AST parsing**.

---

## 🌟 Key Features

- **Smart Token Optimization:** Filters out irrelevant code files and sends only the precise context required for each prompt.
- **Git Delta Detection:** Inspects `git status` and `git diff` to prioritize active workspace files.
- **SQLite Local Storage:** Fast symbol and Repo Map querying (< 2ms) without high RAM overhead.
- **Multi-Project Management:** Dynamically filters and tracks AST symbols per project.
- **Flexible Low AI Integration:** Supports intent analysis using cheap or local AI providers (Ollama Nemotron, Groq Cloud, Anthropic Claude, OpenAI, Google Gemini Flash).
- **Web Dashboard UI:** Built-in web administration dashboard at `http://localhost:3333` for settings, tooltips, and SQLite cache exploration.

---

## 💾 Local Storage & Database Locations

Smart Context MCP persists user settings and indexed workspace data locally in your home directory across operating systems:

| Data Type | macOS / Linux Path | Windows Path |
| :--- | :--- | :--- |
| ⚙️ **User Configuration** | `~/.smart-context/config.json` | `%USERPROFILE%\.smart-context\config.json` |
| 📦 **SQLite Cache Database** | `~/.smart-context/cache.db` | `%USERPROFILE%\.smart-context\cache.db` |

*(You can customize the cache database path anytime via the Web Dashboard settings modal).*

---

## ⚡ Quick Start (Pre-built Release — No Build Required)

End-users do **not** need to install Node.js build tools or run `npm`:

1. Download the pre-built release package: `smart-context-mcp-v1.0.0.zip` (from `release/` folder or GitHub Releases).
2. Unzip `smart-context-mcp-v1.0.0.zip` into your desired folder.
3. Configure your AI Client to point to the executable launcher `smart-context-mcp`:

```json
{
  "mcpServers": {
    "smart-context": {
      "command": "/path/to/unzipped/smart-context-mcp-release/smart-context-mcp",
      "args": []
    }
  }
}
```

---

## 📂 Popular AI Client & VS Code Extension Config Locations

Here is where to find the MCP configuration file across Windows, macOS, and Linux for popular AI Coding Clients & VS Code extensions:

| AI Client / Extension | Operating System | Standard Configuration File Path |
| :--- | :--- | :--- |
| **Claude Desktop App** | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| | Linux | `~/.config/Claude/claude_desktop_config.json` |
| **Cursor IDE** | macOS / Linux | `~/.cursor/mcp.json` *(or Cursor Settings ➔ Features ➔ MCP)* |
| | Windows | `%USERPROFILE%\.cursor\mcp.json` |
| **Continue.dev (VS Code & JetBrains)** | macOS / Linux | `~/.continue/config.json` *(under `experimental.mcpServers`)* |
| | Windows | `%USERPROFILE%\.continue\config.json` |
| **Cline Extension (VS Code)** | macOS | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| | Windows | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| | Linux | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| **Roo Code Extension (VS Code)** | macOS | `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` |
| | Windows | `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json` |
| | Linux | `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json` |
| **Claude Code CLI** | macOS / Linux / Windows | `~/.claude.json` *(under `mcpServers`)* |
| **Codex / VS Code MCP** | macOS / Linux / Windows | `.vscode/mcp.json` *(Workspace settings)* |
| **Antigravity IDE** | macOS / Linux | `~/.gemini/antigravity-ide/mcp_config.json` |
| | Windows | `%USERPROFILE%\.gemini\antigravity-ide\mcp_config.json` |

---

## 🖥️ Web Dashboard UI

When the MCP Server starts, the administration Web Dashboard is available at:

👉 **`http://localhost:3333`**

Features available on the Web Dashboard:
- **Project Filter:** Select and view cached data for specific projects or across all repositories.
- **SQLite Cache Explorer:** View cached files and parsed AST symbols with detailed hover tooltips (`?`).
- **Header Actions (`⚙️ Settings` & `❓ Guide` Modals):** Dynamically update Low AI Providers and view user guides in modal popups.

---

## 📖 Architecture & Standards

This project adheres to the **[ai-read-first](https://github.com/nghiale-soft/ai-read-first)** standard for AI agent workflows.

---

## 🛠️ Developer Setup (For Modifying Source Code)

If you want to contribute or customize the source code:

```bash
# 1. Clone repository
git clone https://github.com/nghiale-soft/smart-context-mcp.git
cd smart-context-mcp

# 2. Install dependencies & build
npm install
npm run build

# 3. Create pre-built standalone ZIP release
npm run release
```

---

## 📜 Helper Scripts (`scripts/`)

- `./scripts/release.sh`: Builds TypeScript source and packages clean ZIP release (`release/smart-context-mcp-v1.0.0.zip`).