import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 32_000;
const ALLOWED_BINARIES = new Set(['node', 'python', 'python3', 'npm', 'pnpm', 'echo']);
const SECRET_RE = /(authorization|cookie|token|secret|password|api[_-]?key|session)[=:]\s*[^\s]+/gi;

const redact = (value) => String(value ?? '').replace(SECRET_RE, '$1=[REDACTED]');
const within = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export async function classifyRepository(repositoryPath) {
  const root = path.resolve(repositoryPath);
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
    steps = [command(['python3', '-m', 'compileall', '-q', '.'], 'syntax-check')];
  } else if (classification.kind === 'static') {
    steps = [{ argv: ['echo', 'static-artifact-ready'], purpose: 'static-validation', cwd: root }];
  } else steps = [];
  return { version: 1, repositoryPath: root, kind: classification.kind, steps };
}

function validateCommand(step, root) {
  if (!step || !Array.isArray(step.argv) || step.argv.length === 0 || step.argv.some((v) => typeof v !== 'string')) throw new Error('command must be a non-empty argv array');
  const [binary, ...args] = step.argv;
  if (!ALLOWED_BINARIES.has(binary) || binary.includes('/') || binary.includes('\\')) throw new Error(`disallowed command: ${binary}`);
  if (args.some((arg) => /[;&|`$<>]/.test(arg))) throw new Error('shell metacharacters are not allowed');
  const cwd = path.resolve(step.cwd || root);
  if (!within(root, cwd)) throw new Error('command cwd escapes repository');
  return { binary, args, cwd };
}

export async function executeFactoryPlan(plan, options = {}) {
  const root = path.resolve(plan.repositoryPath);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = options.maxOutput ?? DEFAULT_MAX_OUTPUT;
  const results = [];
  for (const step of plan.steps || []) {
    const { binary, args, cwd } = validateCommand(step, root);
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
  const root = path.resolve(repositoryPath);
  const artifacts = [];
  for (const relativePath of artifactPaths || []) {
    if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new Error('artifact path must be relative');
    const absolute = path.resolve(root, relativePath);
    if (!within(root, absolute)) throw new Error('artifact path escapes repository');
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) continue;
    const data = await fs.readFile(absolute);
    artifacts.push({ path: relativePath.replaceAll(path.sep, '/'), type: path.extname(relativePath).slice(1) || 'file', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), commandRef });
  }
  return { version: 1, repositoryPath: root, artifacts, externalSideEffects: false };
}

export { redact };
