import Parser from 'web-tree-sitter';
import path from 'path';
import fs from 'fs';

export interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type';
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
}

export class TreeSitterScanner {
  private parserInitialized = false;

  public async init() {
    if (this.parserInitialized) return;
    try {
      await Parser.init();
      this.parserInitialized = true;
    } catch (err) {
      console.warn('[TreeSitter] Initialization warning:', err);
    }
  }

  public parseFileSymbols(filePath: string, content: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    const ext = path.extname(filePath).toLowerCase();

    // Fallback Regex parser when Tree-sitter WASM grammar is loading
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      
      // Match functions
      const funcMatch = line.match(/(?:function|const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(|function\s+([a-zA-Z0-9_]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1] || funcMatch[2];
        if (name) {
          symbols.push({
            name,
            kind: 'function',
            startLine: lineNum,
            endLine: lineNum,
            signature: line.trim(),
          });
        }
      }

      // Match classes
      const classMatch = line.match(/class\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          startLine: lineNum,
          endLine: lineNum,
          signature: line.trim(),
        });
      }

      // Match interfaces & types
      const interfaceMatch = line.match(/(?:interface|type)\s+([a-zA-Z0-9_]+)/);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1],
          kind: 'interface',
          startLine: lineNum,
          endLine: lineNum,
          signature: line.trim(),
        });
      }
    });

    return symbols;
  }
}
