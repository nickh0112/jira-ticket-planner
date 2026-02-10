#!/usr/bin/env npx tsx
/**
 * analyze-codebase.ts
 *
 * Analyzes a codebase and outputs JSON suitable for posting to /api/codebase-context.
 *
 * Usage:
 *   npx tsx scripts/analyze-codebase.ts /path/to/project --name "my-project" [--output json|post] [--server http://localhost:8005]
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALWAYS_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  "coverage",
  ".cache",
  ".turbo",
  ".output",
  "vendor",
]);

const MAX_FILES = 5000;
const MAX_EXPORTS = 500;
const MAX_ROUTES = 200;
const MAX_SCHEMA_HINTS = 50;
const SOURCE_HEAD_LINES = 100;
const SCHEMA_HEAD_CHARS = 500;

const EXTENSION_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".rb": "Ruby",
  ".css": "CSS",
  ".html": "HTML",
  ".json": "JSON",
  ".md": "Markdown",
  ".sql": "SQL",
  ".yml": "YAML",
  ".yaml": "YAML",
};

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
]);

// ---------------------------------------------------------------------------
// Gitignore parser
// ---------------------------------------------------------------------------

interface IgnoreRule {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
  regex: RegExp;
}

function parseGitignore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (let line of content.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }

    const dirOnly = line.endsWith("/");
    if (dirOnly) line = line.slice(0, -1);

    // Remove leading slash (anchored to root) — we still match it as a prefix
    if (line.startsWith("/")) line = line.slice(1);

    const regex = globToRegex(line);
    rules.push({ pattern: line, negated, dirOnly, regex });
  }
  return rules;
}

function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** matches everything including /
        re += ".*";
        i++; // skip second *
        if (glob[i + 1] === "/") i++; // skip trailing /
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === ".") {
      re += "\\.";
    } else if (c === "/") {
      re += "/";
    } else {
      re += c;
    }
  }
  return new RegExp(`(^|/)${re}($|/)`, "i");
}

function isIgnored(
  relativePath: string,
  isDir: boolean,
  rules: IgnoreRule[]
): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(relativePath)) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}

// ---------------------------------------------------------------------------
// File tree walker
// ---------------------------------------------------------------------------

interface FileEntry {
  path: string; // relative
  type: "file" | "directory";
  language?: string;
}

function walkTree(
  rootPath: string,
  ignoreRules: IgnoreRule[]
): { files: FileEntry[]; directories: FileEntry[] } {
  const files: FileEntry[] = [];
  const directories: FileEntry[] = [];
  let fileCount = 0;

  function walk(dirAbsolute: string, dirRelative: string) {
    if (fileCount >= MAX_FILES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbsolute, { withFileTypes: true });
    } catch {
      return; // permission denied, etc.
    }

    // Sort for deterministic output
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (fileCount >= MAX_FILES) return;

      const name = entry.name;
      const rel = dirRelative ? `${dirRelative}/${name}` : name;
      const abs = path.join(dirAbsolute, name);

      // Always-skip directories
      if (entry.isDirectory() && ALWAYS_SKIP.has(name)) continue;

      // Gitignore check
      if (isIgnored(rel, entry.isDirectory(), ignoreRules)) continue;

      if (entry.isDirectory()) {
        directories.push({ path: rel, type: "directory" });
        walk(abs, rel);
      } else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        const language = EXTENSION_LANGUAGE[ext];
        files.push({ path: rel, type: "file", language });
        fileCount++;
      }
    }
  }

  walk(rootPath, "");
  return { files, directories };
}

// ---------------------------------------------------------------------------
// Read first N lines of a file
// ---------------------------------------------------------------------------

function readHeadLines(filePath: string, maxLines: number): string[] {
  const lines: string[] = [];
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(64 * 1024); // 64KB chunk
    let leftover = "";
    let done = false;

    while (!done) {
      const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
      if (bytesRead === 0) break;

      const chunk = leftover + buf.toString("utf8", 0, bytesRead);
      const parts = chunk.split("\n");
      leftover = parts.pop() || "";

      for (const part of parts) {
        lines.push(part);
        if (lines.length >= maxLines) {
          done = true;
          break;
        }
      }
    }

    if (!done && leftover) {
      lines.push(leftover);
    }

    fs.closeSync(fd);
  } catch {
    // unreadable
  }
  return lines;
}

function readHeadChars(filePath: string, maxChars: number): string {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(maxChars);
    const bytesRead = fs.readSync(fd, buf, 0, maxChars, 0);
    fs.closeSync(fd);
    return buf.toString("utf8", 0, bytesRead);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Export extraction
// ---------------------------------------------------------------------------

interface ExportEntry {
  file: string;
  name: string;
  kind: string;
}

function extractExports(
  rootPath: string,
  files: FileEntry[]
): ExportEntry[] {
  const exports: ExportEntry[] = [];

  const tsJsRegex =
    /export\s+(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+(\w+)/;
  const pyDefRegex = /^(def|class)\s+(\w+)/;

  for (const f of files) {
    if (exports.length >= MAX_EXPORTS) break;
    if (!f.language) continue;

    const ext = path.extname(f.path).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    const abs = path.join(rootPath, f.path);
    const lines = readHeadLines(abs, SOURCE_HEAD_LINES);

    for (const line of lines) {
      if (exports.length >= MAX_EXPORTS) break;

      if (ext === ".py") {
        const m = line.match(pyDefRegex);
        if (m) {
          const kind = m[1] === "def" ? "function" : "class";
          exports.push({ file: f.path, name: m[2], kind });
        }
      } else if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        const m = line.match(tsJsRegex);
        if (m) {
          exports.push({ file: f.path, name: m[2], kind: m[1] });
        }
      }
    }
  }

  return exports;
}

// ---------------------------------------------------------------------------
// Route extraction
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  path: string;
  file: string;
}

function extractRoutes(
  rootPath: string,
  files: FileEntry[],
  directories: FileEntry[]
): RouteEntry[] {
  const routes: RouteEntry[] = [];

  // Regex-based route extraction from source files
  const expressRouter =
    /(?:router|app)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/gi;
  const fastAPIFlask =
    /@app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/gi;

  for (const f of files) {
    if (routes.length >= MAX_ROUTES) break;

    const ext = path.extname(f.path).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    const abs = path.join(rootPath, f.path);
    const lines = readHeadLines(abs, SOURCE_HEAD_LINES);
    const content = lines.join("\n");

    // Express / generic Node.js
    let m: RegExpExecArray | null;
    expressRouter.lastIndex = 0;
    while ((m = expressRouter.exec(content)) !== null) {
      if (routes.length >= MAX_ROUTES) break;
      routes.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file: f.path,
      });
    }

    // FastAPI / Flask
    fastAPIFlask.lastIndex = 0;
    while ((m = fastAPIFlask.exec(content)) !== null) {
      if (routes.length >= MAX_ROUTES) break;
      routes.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file: f.path,
      });
    }
  }

  // Next.js file-system routes — look for route.ts/route.js inside app/ directory
  // Also pages/ directory structure
  for (const f of files) {
    if (routes.length >= MAX_ROUTES) break;
    const name = path.basename(f.path);

    // app/ directory route handlers
    if (
      (name === "route.ts" || name === "route.js") &&
      f.path.includes("app/")
    ) {
      const routePath = deriveNextAppRoute(f.path);
      if (routePath) {
        // Try to detect which methods are handled
        const abs = path.join(rootPath, f.path);
        const lines = readHeadLines(abs, SOURCE_HEAD_LINES);
        const content = lines.join("\n");
        const methods = detectNextRouteHandlerMethods(content);
        for (const method of methods) {
          if (routes.length >= MAX_ROUTES) break;
          routes.push({ method, path: routePath, file: f.path });
        }
        if (methods.length === 0) {
          routes.push({ method: "ALL", path: routePath, file: f.path });
        }
      }
    }

    // pages/ directory page routes
    if (
      f.path.startsWith("pages/") &&
      !f.path.startsWith("pages/api/") &&
      !f.path.startsWith("pages/_") &&
      (name.endsWith(".tsx") || name.endsWith(".ts") || name.endsWith(".jsx") || name.endsWith(".js"))
    ) {
      const routePath = deriveNextPagesRoute(f.path);
      if (routePath) {
        routes.push({ method: "PAGE", path: routePath, file: f.path });
      }
    }

    // pages/api/ routes
    if (
      f.path.startsWith("pages/api/") &&
      (name.endsWith(".ts") || name.endsWith(".js"))
    ) {
      const routePath = deriveNextPagesRoute(f.path);
      if (routePath) {
        routes.push({ method: "API", path: routePath, file: f.path });
      }
    }
  }

  return routes;
}

function deriveNextAppRoute(filePath: string): string | null {
  // e.g. app/api/users/[id]/route.ts -> /api/users/[id]
  // e.g. src/app/api/users/route.ts -> /api/users
  const match = filePath.match(/(?:^|\/)(app\/.+)\/route\.[tj]sx?$/);
  if (!match) return null;
  let route = match[1].replace(/^app/, "");
  // Convert Next.js dynamic segments: (group) folders are transparent
  route = route.replace(/\/\([^)]+\)/g, "");
  if (!route.startsWith("/")) route = "/" + route;
  return route || "/";
}

function deriveNextPagesRoute(filePath: string): string | null {
  // e.g. pages/api/users/[id].ts -> /api/users/[id]
  // e.g. pages/index.tsx -> /
  let route = filePath
    .replace(/^pages/, "")
    .replace(/\.(tsx|ts|jsx|js)$/, "");
  if (route.endsWith("/index")) route = route.slice(0, -6) || "/";
  if (!route.startsWith("/")) route = "/" + route;
  return route;
}

function detectNextRouteHandlerMethods(content: string): string[] {
  const methods: string[] = [];
  const handlerRegex =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g;
  const arrowRegex =
    /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = handlerRegex.exec(content)) !== null) {
    if (!methods.includes(m[1])) methods.push(m[1]);
  }
  while ((m = arrowRegex.exec(content)) !== null) {
    if (!methods.includes(m[1])) methods.push(m[1]);
  }
  return methods;
}

// ---------------------------------------------------------------------------
// Dependency reading
// ---------------------------------------------------------------------------

interface Dependencies {
  source: string;
  packages: string[];
}

function readDependencies(rootPath: string): Dependencies[] {
  const deps: Dependencies[] = [];

  // package.json
  const pkgPath = path.join(rootPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const names = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
      deps.push({ source: "package.json", packages: names });
    } catch {
      // malformed
    }
  }

  // requirements.txt
  const reqPath = path.join(rootPath, "requirements.txt");
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, "utf8");
      const names = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split(/[=<>!~]/)[0].trim())
        .filter(Boolean);
      deps.push({ source: "requirements.txt", packages: names });
    } catch {
      // ignore
    }
  }

  // go.mod
  const goModPath = path.join(rootPath, "go.mod");
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, "utf8");
      const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
      if (requireBlock) {
        const names = requireBlock[1]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//"))
          .map((l) => l.split(/\s/)[0])
          .filter(Boolean);
        deps.push({ source: "go.mod", packages: names });
      }
    } catch {
      // ignore
    }
  }

  // Cargo.toml
  const cargoPath = path.join(rootPath, "Cargo.toml");
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, "utf8");
      const inDeps =
        /\[dependencies\]([\s\S]*?)(?:\[|$)/.exec(content);
      if (inDeps) {
        const names = inDeps[1]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"))
          .map((l) => l.split(/\s*=/)[0].trim())
          .filter(Boolean);
        deps.push({ source: "Cargo.toml", packages: names });
      }
    } catch {
      // ignore
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Schema hints
// ---------------------------------------------------------------------------

interface SchemaHint {
  file: string;
  preview: string;
}

function detectSchemaHints(
  rootPath: string,
  files: FileEntry[]
): SchemaHint[] {
  const hints: SchemaHint[] = [];
  const schemaPatterns = [
    /schema/i,
    /migration/i,
    /\.prisma$/i,
  ];
  const modelDirPattern = /^models?\//i;

  for (const f of files) {
    if (hints.length >= MAX_SCHEMA_HINTS) break;

    const name = path.basename(f.path);
    const isSchema =
      schemaPatterns.some((p) => p.test(name)) ||
      schemaPatterns.some((p) => p.test(f.path)) ||
      modelDirPattern.test(f.path);

    if (isSchema) {
      const abs = path.join(rootPath, f.path);
      const preview = readHeadChars(abs, SCHEMA_HEAD_CHARS);
      if (preview.trim()) {
        hints.push({ file: f.path, preview: preview.trim() });
      }
    }
  }

  return hints;
}

// ---------------------------------------------------------------------------
// Directory tree summary (for contextSummary)
// ---------------------------------------------------------------------------

function buildDirectoryTree(
  files: FileEntry[],
  directories: FileEntry[]
): Map<string, number> {
  // Count files per top-level-ish directory (depth 1 and 2)
  const counts = new Map<string, number>();

  for (const f of files) {
    const parts = f.path.split("/");
    if (parts.length >= 2) {
      const topDir = parts[0];
      counts.set(topDir, (counts.get(topDir) || 0) + 1);
    }
    if (parts.length >= 3) {
      const subDir = `${parts[0]}/${parts[1]}`;
      counts.set(subDir, (counts.get(subDir) || 0) + 1);
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Context summary generation
// ---------------------------------------------------------------------------

function generateContextSummary(
  name: string,
  files: FileEntry[],
  directories: FileEntry[],
  languageBreakdown: Record<string, number>,
  deps: Dependencies[],
  routes: RouteEntry[],
  exports: ExportEntry[],
  schemaHints: SchemaHint[]
): string {
  const lines: string[] = [];

  // Primary language
  const sortedLangs = Object.entries(languageBreakdown).sort(
    (a, b) => b[1] - a[1]
  );
  const primaryLang = sortedLangs.length > 0 ? sortedLangs[0][0] : "Unknown";

  lines.push(
    `PROJECT: ${name} (${files.length} files, primary: ${primaryLang})`
  );
  lines.push("");

  // Key dependencies
  if (deps.length > 0) {
    const allPkgs = deps.flatMap((d) => d.packages);
    // Show up to 20 key deps
    const shown = allPkgs.slice(0, 20);
    lines.push(`KEY DEPS: ${shown.join(", ")}${allPkgs.length > 20 ? ` (+${allPkgs.length - 20} more)` : ""}`);
    lines.push("");
  }

  // Architecture
  const dirTree = buildDirectoryTree(files, directories);
  if (dirTree.size > 0) {
    lines.push("ARCHITECTURE:");
    // Group: show top-level dirs, then their children
    const topLevel = new Map<string, number>();
    const subLevel = new Map<string, Map<string, number>>();

    for (const [dir, count] of dirTree) {
      const parts = dir.split("/");
      if (parts.length === 1) {
        topLevel.set(dir, count);
      } else if (parts.length === 2) {
        if (!subLevel.has(parts[0])) subLevel.set(parts[0], new Map());
        subLevel.get(parts[0])!.set(parts[1], count);
      }
    }

    const sortedTop = [...topLevel.entries()].sort((a, b) => b[1] - a[1]);
    for (const [dir, count] of sortedTop.slice(0, 15)) {
      lines.push(`  ${dir}/ (${count} files)`);
      const subs = subLevel.get(dir);
      if (subs) {
        const sortedSubs = [...subs.entries()].sort((a, b) => b[1] - a[1]);
        for (const [sub, subCount] of sortedSubs.slice(0, 8)) {
          lines.push(`    ${sub}/ (${subCount} files)`);
        }
      }
    }
    lines.push("");
  }

  // Route map
  if (routes.length > 0) {
    lines.push("ROUTE MAP:");
    for (const r of routes.slice(0, 40)) {
      lines.push(`  ${r.method} ${r.path} -> ${r.file}`);
    }
    if (routes.length > 40) {
      lines.push(`  ... (+${routes.length - 40} more routes)`);
    }
    lines.push("");
  }

  // Key exports (grouped by file, limit output)
  if (exports.length > 0) {
    lines.push("KEY EXPORTS:");
    const byFile = new Map<string, ExportEntry[]>();
    for (const e of exports) {
      if (!byFile.has(e.file)) byFile.set(e.file, []);
      byFile.get(e.file)!.push(e);
    }
    let shown = 0;
    for (const [file, entries] of byFile) {
      if (shown >= 30) {
        lines.push(
          `  ... (+${byFile.size - 30} more files with exports)`
        );
        break;
      }
      const descs = entries
        .slice(0, 5)
        .map((e) => `${e.name} (${e.kind})`)
        .join(", ");
      const extra =
        entries.length > 5 ? ` +${entries.length - 5} more` : "";
      lines.push(`  ${file}: ${descs}${extra}`);
      shown++;
    }
    lines.push("");
  }

  // Schema
  if (schemaHints.length > 0) {
    lines.push("SCHEMA:");
    // Try to extract table names from migration SQL
    const tableNames = new Set<string>();
    for (const hint of schemaHints) {
      const createTableMatches = hint.preview.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?(\w+)["']?/gi
      );
      for (const m of createTableMatches) {
        tableNames.add(m[1]);
      }
      // Prisma model names
      const prismaModels = hint.preview.matchAll(/model\s+(\w+)\s*\{/g);
      for (const m of prismaModels) {
        tableNames.add(m[1]);
      }
    }

    if (tableNames.size > 0) {
      const tableList = [...tableNames].slice(0, 30).join(", ");
      lines.push(
        `  Tables/Models: ${tableList}${tableNames.size > 30 ? ` (+${tableNames.size - 30} more)` : ""}`
      );
    }

    lines.push(`  Schema files:`);
    for (const hint of schemaHints.slice(0, 10)) {
      lines.push(`    ${hint.file}`);
    }
    if (schemaHints.length > 10) {
      lines.push(
        `    ... (+${schemaHints.length - 10} more schema files)`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Design token extraction
// ---------------------------------------------------------------------------

const DESIGN_TOKEN_FILES = [
  '**/tailwind.config.*',
  '**/variables.css',
  '**/globals.css',
  '**/theme.css',
  '**/theme.ts',
  '**/theme.js',
  '**/index.css',
];

const DESIGN_TOKEN_FILENAMES = new Set([
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
  'variables.css',
  'globals.css',
  'theme.css',
  'theme.ts',
  'theme.js',
  'index.css',
]);

interface DesignTokens {
  stylingApproach: string;
  cssCustomProperties: Record<string, string>;
  tailwindTheme: Record<string, any>;
  themeTokens: Record<string, any>;
}

function extractDesignTokens(
  rootPath: string,
  files: FileEntry[]
): DesignTokens {
  const tokens: DesignTokens = {
    stylingApproach: 'Unknown',
    cssCustomProperties: {},
    tailwindTheme: {},
    themeTokens: {},
  };

  // Detect styling approach from dependencies (check root + child package.json files)
  const pkgFiles = files
    .filter((f) => path.basename(f.path) === 'package.json' && f.path.split('/').length <= 3)
    .map((f) => path.join(rootPath, f.path));
  const rootPkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(rootPkgPath) && !pkgFiles.includes(rootPkgPath)) {
    pkgFiles.unshift(rootPkgPath);
  }
  for (const pkgPath of pkgFiles) {
    if (tokens.stylingApproach !== 'Unknown') break;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (allDeps['tailwindcss']) tokens.stylingApproach = 'Tailwind CSS';
      else if (allDeps['@chakra-ui/react']) tokens.stylingApproach = 'Chakra UI';
      else if (allDeps['@mui/material']) tokens.stylingApproach = 'Material UI';
      else if (allDeps['styled-components']) tokens.stylingApproach = 'styled-components';
      else if (allDeps['@emotion/react']) tokens.stylingApproach = 'Emotion';
    } catch {}
  }

  // Find design token files
  const designFiles = files.filter((f) => {
    const name = path.basename(f.path);
    return DESIGN_TOKEN_FILENAMES.has(name);
  });

  for (const f of designFiles) {
    const abs = path.join(rootPath, f.path);
    const name = path.basename(f.path);

    if (name.endsWith('.css')) {
      // Extract CSS custom properties from :root blocks
      try {
        const content = fs.readFileSync(abs, 'utf8');
        const rootBlocks = content.matchAll(/:root\s*\{([^}]+)\}/g);
        for (const block of rootBlocks) {
          const props = block[1].matchAll(/\s*(--[\w-]+)\s*:\s*([^;]+);/g);
          for (const prop of props) {
            tokens.cssCustomProperties[prop[1].trim()] = prop[2].trim();
          }
        }
        // Also extract standalone custom properties outside :root
        const standaloneProps = content.matchAll(
          /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm
        );
        for (const prop of standaloneProps) {
          if (!tokens.cssCustomProperties[prop[1].trim()]) {
            tokens.cssCustomProperties[prop[1].trim()] = prop[2].trim();
          }
        }
      } catch {}
    } else if (name.startsWith('tailwind.config')) {
      // Extract theme.extend from Tailwind config
      try {
        const content = fs.readFileSync(abs, 'utf8');
        // Extract theme.extend block — regex approach for static analysis
        const extendMatch = content.match(
          /theme\s*:\s*\{[\s\S]*?extend\s*:\s*(\{[\s\S]*?\n\s{4}\})/
        );
        if (extendMatch) {
          tokens.tailwindTheme._raw = extendMatch[1].slice(0, 2000);
        }
        // Also extract colors, fontFamily, fontSize as standalone keys
        const colorMatch = content.match(
          /colors?\s*:\s*(\{[\s\S]*?\n\s{6,8}\})/
        );
        if (colorMatch) {
          tokens.tailwindTheme.colors = colorMatch[1].slice(0, 1000);
        }
        const fontMatch = content.match(
          /fontFamily\s*:\s*(\{[\s\S]*?\n\s{6,8}\})/
        );
        if (fontMatch) {
          tokens.tailwindTheme.fontFamily = fontMatch[1].slice(0, 500);
        }
      } catch {}
    } else if (name === 'theme.ts' || name === 'theme.js') {
      // Extract color/font keys from theme files (Chakra, etc.)
      try {
        const lines = readHeadLines(abs, 200);
        const content = lines.join('\n');
        // Extract color definitions
        const colorMatch = content.match(
          /colors?\s*[=:]\s*(\{[\s\S]*?\n\})/
        );
        if (colorMatch) {
          tokens.themeTokens.colors = colorMatch[1].slice(0, 1000);
        }
        const fontMatch = content.match(
          /fonts?\s*[=:]\s*(\{[\s\S]*?\n\})/
        );
        if (fontMatch) {
          tokens.themeTokens.fonts = fontMatch[1].slice(0, 500);
        }
      } catch {}
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Component catalog extraction
// ---------------------------------------------------------------------------

interface ComponentEntry {
  name: string;
  file: string;
  props: string[];
  classPatterns: string[];
}

function extractComponentCatalog(
  rootPath: string,
  files: FileEntry[]
): ComponentEntry[] {
  const catalog: ComponentEntry[] = [];
  const componentDirPatterns = [
    /(?:^|\/)components\/ui\//,
    /(?:^|\/)components\/common\//,
    /(?:^|\/)components\/shared\//,
  ];
  const isTopLevelComponent = /(?:^|\/)components\/[^/]+\.tsx$/;

  // Filter to component files
  const componentFiles = files.filter((f) => {
    if (!f.path.endsWith('.tsx') && !f.path.endsWith('.jsx')) return false;
    return (
      componentDirPatterns.some((p) => p.test(f.path)) ||
      isTopLevelComponent.test(f.path)
    );
  });

  // Cap at 30 files
  for (const f of componentFiles.slice(0, 30)) {
    const abs = path.join(rootPath, f.path);
    const lines = readHeadLines(abs, 80);
    const content = lines.join('\n');

    // Extract component name from export
    const nameMatch =
      content.match(
        /export\s+(?:default\s+)?function\s+(\w+)/
      ) ||
      content.match(
        /export\s+const\s+(\w+)\s*[=:]/
      );
    if (!nameMatch) continue;

    const name = nameMatch[1];

    // Extract props interface (variant/size props)
    const props: string[] = [];
    const propsMatch = content.match(
      /interface\s+\w*Props\w*\s*\{([^}]*)\}/
    );
    if (propsMatch) {
      const propLines = propsMatch[1].matchAll(
        /(\w+)\s*[?:]?\s*:\s*([^;\n]+)/g
      );
      for (const p of propLines) {
        if (['variant', 'size', 'color', 'intent', 'appearance'].includes(p[1])) {
          props.push(`${p[1]}: ${p[2].trim()}`);
        }
      }
    }

    // Extract className patterns
    const classPatterns: string[] = [];
    const classMatches = content.matchAll(
      /className=["'`]([^"'`]+)["'`]/g
    );
    for (const cm of classMatches) {
      const classes = cm[1].trim();
      if (classes.length > 5 && classes.length < 200 && !classPatterns.includes(classes)) {
        classPatterns.push(classes);
        if (classPatterns.length >= 3) break;
      }
    }
    // Also match template literal className
    const templateClassMatches = content.matchAll(
      /className=\{[`'"]([^`'"]+)[`'"]\}/g
    );
    for (const cm of templateClassMatches) {
      const classes = cm[1].trim();
      if (classes.length > 5 && classes.length < 200 && !classPatterns.includes(classes)) {
        classPatterns.push(classes);
        if (classPatterns.length >= 3) break;
      }
    }

    catalog.push({ name, file: f.path, props, classPatterns });
  }

  return catalog;
}

// ---------------------------------------------------------------------------
// Design context generation
// ---------------------------------------------------------------------------

function generateDesignContext(
  tokens: DesignTokens,
  catalog: ComponentEntry[]
): string {
  const lines: string[] = [];

  lines.push('DESIGN SYSTEM:');
  lines.push(`  Styling approach: ${tokens.stylingApproach}`);
  lines.push('');

  // CSS Custom Properties
  const cssProps = Object.entries(tokens.cssCustomProperties);
  if (cssProps.length > 0) {
    lines.push('COLOR PALETTE (CSS Custom Properties):');
    for (const [name, value] of cssProps.slice(0, 40)) {
      lines.push(`  ${name}: ${value}`);
    }
    if (cssProps.length > 40) {
      lines.push(`  ... (+${cssProps.length - 40} more)`);
    }
    lines.push('');
  }

  // Tailwind theme
  if (tokens.tailwindTheme.colors || tokens.tailwindTheme.fontFamily || tokens.tailwindTheme._raw) {
    lines.push('TAILWIND THEME:');
    if (tokens.tailwindTheme.colors) {
      lines.push(`  colors: ${tokens.tailwindTheme.colors}`);
    }
    if (tokens.tailwindTheme.fontFamily) {
      lines.push(`  fontFamily: ${tokens.tailwindTheme.fontFamily}`);
    }
    if (!tokens.tailwindTheme.colors && !tokens.tailwindTheme.fontFamily && tokens.tailwindTheme._raw) {
      lines.push(`  extend: ${tokens.tailwindTheme._raw}`);
    }
    lines.push('');
  }

  // Theme tokens (Chakra, etc.)
  if (tokens.themeTokens.colors || tokens.themeTokens.fonts) {
    lines.push('THEME TOKENS:');
    if (tokens.themeTokens.colors) {
      lines.push(`  colors: ${tokens.themeTokens.colors}`);
    }
    if (tokens.themeTokens.fonts) {
      lines.push(`  fonts: ${tokens.themeTokens.fonts}`);
    }
    lines.push('');
  }

  // Component patterns
  if (catalog.length > 0) {
    lines.push('COMPONENT PATTERNS:');
    for (const comp of catalog) {
      const parts = [`  ${comp.name}`];
      if (comp.props.length > 0) {
        parts.push(`[${comp.props.join(', ')}]`);
      }
      if (comp.classPatterns.length > 0) {
        parts.push(`: "${comp.classPatterns[0]}"`);
      }
      lines.push(parts.join(' '));
    }
    lines.push('');
  }

  const result = lines.join('\n');
  // Cap at ~3KB
  return result.slice(0, 3072);
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface CLIArgs {
  rootPath: string;
  name: string;
  output: "json" | "post";
  server: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.error(`Usage: npx tsx scripts/analyze-codebase.ts /path/to/project --name "my-project" [--output json|post] [--server http://localhost:8005]

Options:
  --name      Project name (required)
  --output    Output mode: "json" (default, prints to stdout) or "post" (sends to server)
  --server    Server URL for POST mode (default: http://localhost:8005)
  --help      Show this help message`);
    process.exit(1);
  }

  let rootPath = "";
  let name = "";
  let output: "json" | "post" = "json";
  let server = "http://localhost:8005";

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--name" && i + 1 < args.length) {
      name = args[++i];
    } else if (arg === "--output" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== "json" && val !== "post") {
        console.error(`Invalid --output value: ${val}. Must be "json" or "post".`);
        process.exit(1);
      }
      output = val;
    } else if (arg === "--server" && i + 1 < args.length) {
      server = args[++i];
    } else if (!arg.startsWith("--") && !rootPath) {
      rootPath = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  if (!rootPath) {
    console.error("Error: project path is required as the first argument.");
    process.exit(1);
  }

  if (!name) {
    // Derive name from directory
    name = path.basename(path.resolve(rootPath));
  }

  rootPath = path.resolve(rootPath);

  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    console.error(`Error: ${rootPath} is not a valid directory.`);
    process.exit(1);
  }

  return { rootPath, name, output, server };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const startTime = Date.now();

  const log = (msg: string) =>
    process.stderr.write(`[analyze] ${msg}\n`);

  log(`Analyzing: ${args.rootPath}`);
  log(`Project name: ${args.name}`);

  // Load .gitignore
  let ignoreRules: IgnoreRule[] = [];
  const gitignorePath = path.join(args.rootPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf8");
    ignoreRules = parseGitignore(content);
    log(`Loaded .gitignore (${ignoreRules.length} rules)`);
  }

  // Walk tree
  log("Walking file tree...");
  const { files, directories } = walkTree(args.rootPath, ignoreRules);
  log(`Found ${files.length} files, ${directories.length} directories`);

  // Language breakdown
  const languageBreakdown: Record<string, number> = {};
  for (const f of files) {
    if (f.language) {
      languageBreakdown[f.language] =
        (languageBreakdown[f.language] || 0) + 1;
    }
  }

  // Exports
  log("Extracting exports...");
  const exports = extractExports(args.rootPath, files);
  log(`Found ${exports.length} exports`);

  // Routes
  log("Extracting routes...");
  const routes = extractRoutes(args.rootPath, files, directories);
  log(`Found ${routes.length} routes`);

  // Dependencies
  log("Reading dependencies...");
  const deps = readDependencies(args.rootPath);
  const totalDeps = deps.reduce((s, d) => s + d.packages.length, 0);
  log(`Found ${totalDeps} dependencies from ${deps.length} source(s)`);

  // Schema hints
  log("Detecting schema hints...");
  const schemaHints = detectSchemaHints(args.rootPath, files);
  log(`Found ${schemaHints.length} schema hints`);

  // Design tokens & component catalog
  log("Extracting design tokens...");
  const designTokens = extractDesignTokens(args.rootPath, files);
  log(`Styling approach: ${designTokens.stylingApproach}, CSS vars: ${Object.keys(designTokens.cssCustomProperties).length}`);

  log("Extracting component catalog...");
  const componentCatalog = extractComponentCatalog(args.rootPath, files);
  log(`Found ${componentCatalog.length} component patterns`);

  const designContext = generateDesignContext(designTokens, componentCatalog);

  // Context summary
  log("Generating context summary...");
  const contextSummary = generateContextSummary(
    args.name,
    files,
    directories,
    languageBreakdown,
    deps,
    routes,
    exports,
    schemaHints
  );

  // Build file tree for raw (just paths and types, not full entries)
  const fileTree = files.map((f) => ({
    path: f.path,
    type: f.type,
    language: f.language,
  }));

  // Raw analysis
  const rawObj = {
    fileTree,
    exports,
    routes,
    dependencies: deps,
    schemaHints,
  };

  // Final output
  const output = {
    name: args.name,
    rootPath: args.rootPath,
    analyzedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalDirectories: directories.length,
    languageBreakdown,
    contextSummary,
    designContext: designContext || undefined,
    rawAnalysis: JSON.stringify(rawObj),
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`Analysis complete in ${elapsed}s`);

  if (args.output === "json") {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else if (args.output === "post") {
    const url = `${args.server}/api/codebase-context`;
    log(`POSTing to ${url}...`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(output),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(
          `Error: server responded with ${response.status}: ${text}`
        );
        process.exit(1);
      }
      const result = await response.json();
      log("POST successful");
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (err: any) {
      console.error(`Error posting to server: ${err.message}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
