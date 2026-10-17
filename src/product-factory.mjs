import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 32_000;
const ALLOWED_BINARIES = new Set(['node', 'python', 'python3', 'npm', 'pnpm', 'echo']);
const SECRET_RE = /(authorization|cookie|token|secret|password|api[_-]?key|session)[=:]\s*[^\s]+/gi;
const DEFAULT_DISCOVERY = Object.freeze({ maxFiles: 32, maxBytes: 16 * 1024 * 1024 });
const ARTIFACT_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.mov',
  '.pdf', '.zip', '.glb', '.gltf', '.blend', '.stl', '.step', '.stp', '.obj'
]);
const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'dist', 'build', 'coverage', '.next',
  '.cache', '.venv', 'venv', '__pycache__', '.pytest_cache'
]);

const redact = (value) => String(value ?? '').replace(SECRET_RE, '$1=[REDACTED]');
const within = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export async function classifyRepository(repositoryPath) {
  const root = await fs.realpath(path.resolve(repositoryPath));
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error('repository path must be a directory');
  const entries = new Set(await fs.readdir(root));
  let kind = 'unknown';
  let confidence = 'low';
  if (entries.has('package.json')) { kind = 'node'; confidence = 'high'; }
  else if (entries.has('pyproject.toml') || entries.has('setup.py') || entries.has('requirements.txt')) { kind = 'python'; confidence = 'high'; }
  else if (entries.has('index.html') || entries.has('public')) { kind = 'static'; confidence = 'medium'; }
  const files = [...entries].sort();
  return { repositoryPath: root, kind, confidence, files };
}

export function createFactoryPlan(classification) {
  const root = path.resolve(classification.repositoryPath);
  const command = (argv, purpose) => ({ argv, purpose, cwd: root });
  let steps;
  if (classification.kind === 'node') {
    steps = [command(['node', '--check', 'src/server.mjs'], 'syntax-check')];
  } else if (classification.kind === 'python') {
    const syntaxCheck = "import pathlib\nfor p in pathlib.Path('.').rglob('*.py'):\n compile(p.read_text(), str(p), 'exec')";
    steps = [command(['python3', '-B', '-c', syntaxCheck], 'syntax-check')];
  } else if (classification.kind === 'static') {
    steps = [{ argv: ['echo', 'static-artifact-ready'], purpose: 'static-validation', cwd: root }];
  } else steps = [];
  return { version: 1, repositoryPath: root, kind: classification.kind, steps };
}

async function validateCommand(step, root) {
  if (!step || !Array.isArray(step.argv) || step.argv.length === 0 || step.argv.some((v) => typeof v !== 'string')) throw new Error('command must be a non-empty argv array');
  const [binary, ...args] = step.argv;
  if (!ALLOWED_BINARIES.has(binary) || binary.includes('/') || binary.includes('\\')) throw new Error(`disallowed command: ${binary}`);
  if (args.some((arg) => /[;&|`$<>]/.test(arg))) throw new Error('shell metacharacters are not allowed');
  const requestedCwd = path.resolve(step.cwd || root);
  let cwd;
  try { cwd = await fs.realpath(requestedCwd); } catch { throw new Error('command cwd does not exist'); }
  if (!within(root, cwd)) throw new Error('command cwd escapes repository');
  return { binary, args, cwd };
}

export async function executeFactoryPlan(plan, options = {}) {
  const root = await fs.realpath(path.resolve(plan.repositoryPath));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = options.maxOutput ?? DEFAULT_MAX_OUTPUT;
  const results = [];
  for (const step of plan.steps || []) {
    const { binary, args, cwd } = await validateCommand(step, root);
    const result = await new Promise((resolve) => {
      const child = spawn(binary, args, { cwd, shell: false, env: { PATH: process.env.PATH || '' } });
      let stdout = '', stderr = '', timedOut = false;
      const append = (target, chunk) => target.length < maxOutput ? (target + chunk.toString()).slice(0, maxOutput) : target;
      child.stdout.on('data', (c) => { stdout = append(stdout, c); });
      child.stderr.on('data', (c) => { stderr = append(stderr, c); });
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ argv: [binary, ...args], cwd, purpose: step.purpose, status: timedOut ? 'TIMEOUT' : (code === 0 ? 'SUCCEEDED' : 'FAILED'), exitCode: code, signal, stdout: redact(stdout), stderr: redact(stderr) });
      });
      child.on('error', (error) => { clearTimeout(timer); resolve({ argv: [binary, ...args], cwd, purpose: step.purpose, status: 'FAILED', error: redact(error.message), stdout: redact(stdout), stderr: redact(stderr) }); });
    });
    results.push(result);
    if (result.status !== 'SUCCEEDED') break;
  }
  return { version: 1, repositoryPath: root, status: results.every((r) => r.status === 'SUCCEEDED') ? 'SUCCEEDED' : 'FAILED', results, externalSideEffects: false };
}

export async function collectArtifactEvidence(repositoryPath, artifactPaths, commandRef = null) {
  const root = await fs.realpath(path.resolve(repositoryPath));
  const artifacts = [];
  for (const relativePath of artifactPaths || []) {
    if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new Error('artifact path must be relative');
    const absolute = path.resolve(root, relativePath);
    if (!within(root, absolute)) throw new Error('artifact path escapes repository');
    let resolved;
    try { resolved = await fs.realpath(absolute); } catch { throw new Error(`artifact path does not exist: ${relativePath}`); }
    if (!within(root, resolved)) throw new Error('artifact path escapes repository');
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) continue;
    const data = await fs.readFile(resolved);
    artifacts.push({ path: path.relative(root, resolved).replaceAll(path.sep, '/'), type: path.extname(relativePath).slice(1) || 'file', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), commandRef });
  }
  return { version: 1, repositoryPath: root, artifacts, externalSideEffects: false };
}

/**
 * Find bounded, read-only artifact candidates under a repository. Candidates
 * are hints for evidence collection, never publication assets or authority.
 */
export async function discoverArtifactCandidates(repositoryPath, options = {}) {
  const root = await fs.realpath(path.resolve(repositoryPath));
  const maxFiles = Math.min(DEFAULT_DISCOVERY.maxFiles, Math.max(1, Number(options.maxFiles) || DEFAULT_DISCOVERY.maxFiles));
  const maxBytes = Math.min(DEFAULT_DISCOVERY.maxBytes, Math.max(1, Number(options.maxBytes) || DEFAULT_DISCOVERY.maxBytes));
  const candidates = [];
  let totalBytes = 0;
  async function walk(directory, depth = 0) {
    if (candidates.length >= maxFiles || totalBytes >= maxBytes || depth > 8) return;
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (candidates.length >= maxFiles || totalBytes >= maxBytes) break;
      if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await walk(candidate, depth + 1);
        continue;
      }
      if (!entry.isFile() || !ARTIFACT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      let resolved;
      try { resolved = await fs.realpath(candidate); } catch { continue; }
      if (!within(root, resolved)) continue;
      let stat;
      try { stat = await fs.stat(resolved); } catch { continue; }
      if (!stat.isFile() || stat.size > maxBytes - totalBytes) continue;
      const relativePath = path.relative(root, resolved).replaceAll(path.sep, '/');
      candidates.push({ path: relativePath, bytes: stat.size, extension: path.extname(relativePath).toLowerCase() });
      totalBytes += stat.size;
    }
  }
  await walk(root);
  return { version: 1, repositoryPath: root, candidates, limits: { maxFiles, maxBytes }, totalBytes, externalSideEffects: false };
}

export { redact, ARTIFACT_EXTENSIONS };
