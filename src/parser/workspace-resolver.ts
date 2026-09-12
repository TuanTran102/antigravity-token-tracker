import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface WorkspaceResolverOptions {
  customWorkspaceStorageDir?: string;
}

export class WorkspaceResolver {
  private workspaceCache: Map<string, string | undefined> = new Map();
  private knownWorkspaces: string[] = [];
  private workspacesLoaded = false;
  private customWorkspaceStorageDir?: string;

  constructor(options: WorkspaceResolverOptions = {}) {
    this.customWorkspaceStorageDir = options.customWorkspaceStorageDir;
  }

  private ensureWorkspacesLoaded(): void {
    if (this.workspacesLoaded) return;
    this.workspacesLoaded = true;

    const storageDir = this.customWorkspaceStorageDir || path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Antigravity IDE',
      'User',
      'workspaceStorage'
    );

    if (!fs.existsSync(storageDir)) return;

    try {
      const entries = fs.readdirSync(storageDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const wsJsonPath = path.join(storageDir, entry.name, 'workspace.json');
          if (fs.existsSync(wsJsonPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
              if (typeof data.folder === 'string') {
                const rawPath = data.folder.replace(/^file:\/\//, '');
                const decoded = decodeURIComponent(rawPath).replace(/\/+$/, '');
                if (decoded && !this.knownWorkspaces.includes(decoded)) {
                  this.knownWorkspaces.push(decoded);
                }
              }
            } catch {
              // Skip invalid json
            }
          }
        }
      }
      // Sort longest first to prioritize more specific nested workspace roots
      this.knownWorkspaces.sort((a, b) => b.length - a.length);
    } catch {
      // Graceful fallback if storage cannot be accessed
    }
  }

  public resolveWorkspace(conversationId: string, transcriptPath?: string): string | undefined {
    if (this.workspaceCache.has(conversationId)) {
      return this.workspaceCache.get(conversationId);
    }

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return undefined;
    }

    this.ensureWorkspacesLoaded();

    try {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const text = parsed.content || '';

          // 1. Check URI mapping: [URI] -> [CorpusName]: <URI>
          const uriMatch = text.match(/\[URI\] -> \[CorpusName\]:\s*([^\s\n]+)/);
          if (uriMatch) {
            const raw = uriMatch[1].replace(/^file:\/\//, '').replace(/\/+$/, '');
            const decoded = decodeURIComponent(raw);
            const wsName = path.basename(decoded).replace(/["']/g, '');
            if (wsName) {
              this.workspaceCache.set(conversationId, wsName);
              return wsName;
            }
          }

          // 2. Check for known workspace paths anywhere in text
          for (const kw of this.knownWorkspaces) {
            if (text.includes(kw)) {
              const wsName = path.basename(kw).replace(/["']/g, '');
              this.workspaceCache.set(conversationId, wsName);
              return wsName;
            }
          }

          // 3. Check Active Document: <path>
          const docMatch = text.match(/Active Document:\s*([^\s\n\(]+)/);
          if (docMatch) {
            const docPath = docMatch[1].replace(/["']/g, '');
            for (const kw of this.knownWorkspaces) {
              if (docPath.startsWith(kw)) {
                const wsName = path.basename(kw).replace(/["']/g, '');
                this.workspaceCache.set(conversationId, wsName);
                return wsName;
              }
            }
            const fallbackMatch = docPath.match(/(?:Projects|workspaces|workspace|repos|source)\/([^\/\s\n"']+)/i);
            if (fallbackMatch && fallbackMatch[1]) {
              const wsName = fallbackMatch[1];
              this.workspaceCache.set(conversationId, wsName);
              return wsName;
            }
          }

          // 4. Check tool calls arguments
          if (Array.isArray(parsed.tool_calls)) {
            for (const tc of parsed.tool_calls) {
              let args = tc.arguments || tc.args;
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch {
                  // Ignore JSON parse error
                }
              }
              if (args && typeof args === 'object') {
                const candidatePath = (args.Cwd || args.DirectoryPath || args.SearchPath || args.AbsolutePath || args.TargetFile) as string | undefined;
                if (typeof candidatePath === 'string') {
                  const cleaned = candidatePath.replace(/["']/g, '');
                  for (const kw of this.knownWorkspaces) {
                    if (cleaned.startsWith(kw)) {
                      const wsName = path.basename(kw).replace(/["']/g, '');
                      this.workspaceCache.set(conversationId, wsName);
                      return wsName;
                    }
                  }
                  const fallbackMatch = cleaned.match(/(?:Projects|workspaces|workspace|repos|source)\/([^\/\s\n"']+)/i);
                  if (fallbackMatch && fallbackMatch[1]) {
                    const wsName = fallbackMatch[1];
                    this.workspaceCache.set(conversationId, wsName);
                    return wsName;
                  }
                }
              }
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    } catch {
      // Graceful error handling
    }

    this.workspaceCache.set(conversationId, undefined);
    return undefined;
  }
}
