import { execSync } from 'child_process';
import path from 'path';

export interface GitDeltaResult {
  isGitRepo: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
}

export function getGitDelta(workspacePath: string): GitDeltaResult {
  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];
    const stagedFiles: string[] = [];

    const lines = statusOutput.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3).trim();

      if (statusCode.includes('M') || statusCode.includes('D')) {
        modifiedFiles.push(filePath);
      }
      if (statusCode.includes('?')) {
        untrackedFiles.push(filePath);
      }
      if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
        stagedFiles.push(filePath);
      }
    }

    return {
      isGitRepo: true,
      modifiedFiles: Array.from(new Set(modifiedFiles)),
      untrackedFiles: Array.from(new Set(untrackedFiles)),
      stagedFiles: Array.from(new Set(stagedFiles)),
    };
  } catch (err) {
    return {
      isGitRepo: false,
      modifiedFiles: [],
      untrackedFiles: [],
      stagedFiles: [],
    };
  }
}
