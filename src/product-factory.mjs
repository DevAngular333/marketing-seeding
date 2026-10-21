import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 32_000;
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
const SAFE_MANIFEST_KEYS = new Set(['build', 'test', 'render', 'validate']);
const SAFE_MANIFEST_SOURCE_EXTENSIONS = new Set(['.js', '.mjs']);
const INTERNAL_PYTHON_SYNTAX_SCRIPT = "import pathlib\nfor p in pathlib.Path('.').rglob('*.py'):\n compile(p.read_text(), str(p), 'exec')";
const INTERNAL_STATIC_VALIDATION_ARGV = Object.freeze(['echo', 'static-artifact-ready']);
const SANDBOX_PREFLIGHT_VERSION = 1;
const SANDBOX_CHECKS = Object.freeze([
  'backendInvocation',
  'profileIntegrity',
  'networkDenied',
  'filesystemScope',
  'childProcessPolicy',
  'timeoutCleanup',
  'resourceLimits'
]);
const SANDBOX_CHECK_STATUS = new Set(['PASS', 'FAIL', 'UNSUPPORTED', 'UNAVAILABLE']);
const SEATBELT_PYTHON = 'python3';
const SEATBELT_EXECUTOR_SCRIPT = String.raw`import json,sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve().parent))
from tool_executor import execute_command
request=json.loads(sys.argv[2])
print(json.dumps(execute_command(request), separators=(',', ':')))`;

// System-Agentic_AI owns the audited Seatbelt executor.  Marketing-seeding
// may inspect that backend through this adapter, but it must never promote
// backend presence into execution eligibility.  The individual policy checks
// remain an explicit attestation boundary owned by the host runtime.
const DEFAULT_SYSTEM_AGENTIC_RUNTIME_ROOT = path.resolve(
  process.env.SYSTEM_AGENTIC_RUNTIME_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'System-Agentic_AI'),
);

/**
 * Project bounded, secret-safe Product Factory evidence for read-only views.
 * This never exposes command output or changes execution eligibility.
 */
export function projectFactoryRunEvidence(runs = [], { limit = 20 } = {}) {
  const boundedLimit = Math.min(50, Math.max(0, Number.isSafeInteger(limit) ? limit : 20));
  return (Array.isArray(runs) ? [...runs] : [])
    .filter((run) => run && typeof run === 'object')
    .sort((left, right) => {
      const time = String(right.completedAt || '').localeCompare(String(left.completedAt || ''));
      return time || String(right.id || '').localeCompare(String(left.id || ''));
    })
    .slice(0, boundedLimit)
    .map((run) => {
      const artifacts = Array.isArray(run.artifacts?.artifacts) ? run.artifacts.artifacts : [];
      return {
        id: String(run.id || ''),
        campaignId: run.campaignId ? String(run.campaignId) : null,
        status: String(run.status || 'UNKNOWN'),
        externalSideEffects: run.externalSideEffects === true,
        classification: run.classification ? {
          kind: String(run.classification.kind || 'unknown'),
          confidence: String(run.classification.confidence || 'low')
        } : null,
        planStatus: String(run.plan?.projectEvidence?.status || 'UNKNOWN'),
        execution: run.execution ? {
          status: String(run.execution.status || 'UNKNOWN'),
          externalSideEffects: run.execution.externalSideEffects === true,
          resultCount: Array.isArray(run.execution.results) ? run.execution.results.length : 0
        } : null,
        artifactCount: artifacts.length,
        artifacts: artifacts.slice(0, 32).map((artifact) => ({
          path: redact(String(artifact.path || '').replaceAll('\\', '/')).slice(0, 240),
          sha256: /^[a-f0-9]{64}$/i.test(String(artifact.sha256 || '')) ? String(artifact.sha256).toLowerCase() : null,
          bytes: Number.isSafeInteger(artifact.bytes) ? artifact.bytes : null,
          commandRef: Array.isArray(artifact.commandRef)
            ? artifact.commandRef.map((item) => redact(String(item)).slice(0, 120)).slice(0, 8)
            : (artifact.commandRef ? redact(String(artifact.commandRef)).slice(0, 120) : null)
        }))
      };
    });
}

const redact = (value) => String(value ?? '').replace(SECRET_RE, '$1=[REDACTED]');
const within = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

function sandboxCheckStatus(value, fallback = 'UNSUPPORTED') {
  const normalized = String(value || '').trim().toUpperCase();
  return SANDBOX_CHECK_STATUS.has(normalized) ? normalized : fallback;
}

function evaluateSandboxCapability({ backend, present, checks }) {
  const normalizedChecks = Object.fromEntries(SANDBOX_CHECKS.map((key) => [key, sandboxCheckStatus(checks?.[key])]));
  if (!present) normalizedChecks.backendInvocation = 'UNAVAILABLE';
  const allPass = SANDBOX_CHECKS.every((key) => normalizedChecks[key] === 'PASS');
  const status = !present || normalizedChecks.backendInvocation === 'UNAVAILABLE' || normalizedChecks.backendInvocation === 'FAIL'
    ? 'UNAVAILABLE'
    : (allPass ? 'AVAILABLE' : 'UNSUPPORTED');
  return {
    version: SANDBOX_PREFLIGHT_VERSION,
    backend,
    profile: { id: 'factory-sandbox-v1', version: 1, status: normalizedChecks.profileIntegrity },
    status,
    checks: normalizedChecks,
    limits: {
      network: normalizedChecks.networkDenied,
      filesystem: normalizedChecks.filesystemScope,
      childProcesses: normalizedChecks.childProcessPolicy,
      timeoutCleanup: normalizedChecks.timeoutCleanup,
      resourceLimits: normalizedChecks.resourceLimits
    },
    executionEligible: status === 'AVAILABLE' && allPass,
    unsafeCommandDisposition: 'NOT_EXECUTED_UNSAFE'
  };
}

/** Pure evaluator used by tests and future audited profile adapters. */
export function evaluateFactorySandboxCapability(input = {}) {
  return evaluateSandboxCapability({
    backend: String(input.backend || 'sandbox-exec'),
    present: input.backendPresent === true,
    checks: input.checks
  });
}

async function executableFile(pathname) {
  if (!pathname) return false;
  try {
    const { constants } = await import('node:fs');
    await fs.access(pathname, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function invokeSandboxBackend(backendPath, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(backendPath, ['-n', 'no-network', '/usr/bin/true'], {
      shell: false,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { PATH: '/usr/bin:/bin' }
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch {}
    }, timeoutMs);
    child.on('error', () => finish({ ok: false, status: 'FAIL' }));
    child.on('close', (code) => finish({ ok: !timedOut && code === 0, status: timedOut ? 'FAIL' : (code === 0 ? 'PASS' : 'FAIL') }));
  });
}

/**
 * Inspect whether an audited Product Factory sandbox is available.
 *
 * Backend presence or a successful harmless wrapper invocation is not enough
 * to make arbitrary project commands eligible. Required checks default to
 * UNSUPPORTED and must be independently attested before this result can ever
 * become AVAILABLE. No caller currently consumes executionEligible to run a
 * project command.
 */
export async function probeFactorySandboxCapability(options = {}) {
  const backend = String(options.backend || 'sandbox-exec');
  const backendPath = options.backendPath ?? (process.platform === 'darwin' ? '/usr/bin/sandbox-exec' : null);
  const present = options.backendPresent === undefined
    ? await executableFile(backendPath)
    : options.backendPresent === true;
  const checks = Object.fromEntries(SANDBOX_CHECKS.map((key) => [key, 'UNSUPPORTED']));
  let invocation = { ok: false, status: present ? 'UNSUPPORTED' : 'UNAVAILABLE' };
  if (!present) checks.backendInvocation = 'UNAVAILABLE';
  else {
    try {
      invocation = options.invoke
        ? await options.invoke({ backend, profileId: 'factory-sandbox-v1' })
        : await invokeSandboxBackend(backendPath, Math.min(5_000, Math.max(100, Number(options.timeoutMs) || 2_000)));
    } catch {
      invocation = { ok: false, status: 'FAIL' };
    }
    checks.backendInvocation = invocation?.ok === true ? 'PASS' : sandboxCheckStatus(invocation?.status, 'FAIL');
  }
  return evaluateSandboxCapability({ backend, present, checks });
}

/**
 * Read-only bridge to the shared System-Agentic_AI Seatbelt executor.
 *
 * The bridge only attests that the frozen executor exists and is importable;
 * policy checks intentionally stay UNSUPPORTED until the host supplies an
 * audited profile attestation.  This prevents a marketing domain adapter
 * from silently enabling arbitrary repository execution.
 */
export async function probeSystemAgenticSeatbeltCapability(options = {}) {
  const runtimeRoot = path.resolve(String(options.runtimeRoot || DEFAULT_SYSTEM_AGENTIC_RUNTIME_ROOT));
  const executorPath = path.join(runtimeRoot, 'products', 'agent-runtime', 'tool_executor.py');
  let present = options.backendPresent === true;
  if (options.backendPresent === undefined) {
    try { await fs.access(executorPath); present = true; } catch { present = false; }
  }
  const checks = Object.fromEntries(SANDBOX_CHECKS.map((key) => [key, 'UNSUPPORTED']));
  checks.backendInvocation = present ? 'PASS' : 'UNAVAILABLE';
  // The host may provide an independently audited attestation. Backend
  // presence alone never enables project execution.
  const attestation = options.attestation && typeof options.attestation === 'object' ? options.attestation : null;
  for (const key of SANDBOX_CHECKS) {
    if (attestation && Object.hasOwn(attestation, key)) checks[key] = sandboxCheckStatus(attestation[key]);
  }
  return evaluateSandboxCapability({
    backend: 'system-agentic-seatbelt',
    present,
    checks
  });
}

function isSeatbeltCapabilityUsable(capability) {
  return capability && capability.backend === 'system-agentic-seatbelt' &&
    capability.executionEligible === true && capability.status === 'AVAILABLE' &&
    capability.profile?.id === 'factory-sandbox-v1' && Number(capability.profile?.version) === 1 &&
    SANDBOX_CHECKS.every((key) => capability.checks?.[key] === 'PASS');
}

/** Invoke the frozen System-Agentic_AI typed executor. No shell is involved. */
export async function invokeSystemAgenticSeatbelt(request, options = {}) {
  const runtimeRoot = path.resolve(String(options.runtimeRoot || DEFAULT_SYSTEM_AGENTIC_RUNTIME_ROOT));
  const executorPath = path.join(runtimeRoot, 'products', 'agent-runtime', 'tool_executor.py');
  const python = String(options.python || SEATBELT_PYTHON);
  if (!request || typeof request !== 'object' || !request.workspace || !request.arguments?.argv) throw new Error('malformed Seatbelt request');
  if (typeof options.spawnImpl === 'function') {
    return options.spawnImpl({ python, executorPath, script: SEATBELT_EXECUTOR_SCRIPT, request });
  }
  const resolvedExecutorPath = await fs.realpath(executorPath);
  if (!within(runtimeRoot, resolvedExecutorPath)) throw new Error('Seatbelt executor escapes runtime root');
  return new Promise((resolve) => {
    const child = spawn(python, ['-c', SEATBELT_EXECUTOR_SCRIPT, resolvedExecutorPath, JSON.stringify(request)], {
      cwd: runtimeRoot, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH || '' }
    });
    let stdout = '', stderr = '', timedOut = false;
    const timeoutMs = Math.min(125_000, Math.max(1_000, Number(options.timeoutMs) || 130_000));
    const append = (target, chunk) => target.length < DEFAULT_MAX_OUTPUT ? (target + chunk.toString()).slice(0, DEFAULT_MAX_OUTPUT) : target;
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    const killTree = (signal) => {
      try {
        // The bridge owns a detached process group so a timeout cannot leave
        // the Python executor or its Seatbelt child running in the background.
        if (child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        try { child.kill(signal); } catch {}
      }
    };
    let forceTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree('SIGTERM');
      forceTimer = setTimeout(() => killTree('SIGKILL'), 500);
    }, timeoutMs);
    const finish = (value) => { clearTimeout(timer); clearTimeout(forceTimer); resolve(value); };
    child.on('error', (error) => finish({ execution_status: 'FAILED', stderr: redact(error.message) }));
    child.on('close', (code) => {
      if (timedOut) return finish({ execution_status: 'TIMED_OUT', stderr: redact(stderr) });
      let parsed = null;
      try { parsed = JSON.parse(stdout.trim()); } catch {}
      finish(parsed && typeof parsed === 'object' ? parsed : { execution_status: 'FAILED', exit_code: code, stdout: redact(stdout), stderr: redact(stderr) });
    });
  });
}

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
    steps = [command(['python3', '-B', '-c', INTERNAL_PYTHON_SYNTAX_SCRIPT], 'syntax-check')];
  } else if (classification.kind === 'static') {
    steps = [{ argv: [...INTERNAL_STATIC_VALIDATION_ARGV], purpose: 'static-validation', cwd: root }];
  } else steps = [];
  return { version: 1, repositoryPath: root, kind: classification.kind, steps };
}

function splitArgv(script) {
  if (typeof script !== 'string' || !script.trim() || /[;&|`$<>\\\n\r]/.test(script)) return null;
  const argv = script.trim().split(/\s+/);
  if (argv.length !== 3 || argv[0] !== 'node' || argv[1] !== '--check') return null;
  if (argv.some((arg) => arg.length > 240)) return null;
  const source = argv[2].replaceAll('\\', '/');
  if (!source || source.startsWith('/') || source.split('/').includes('..') || !SAFE_MANIFEST_SOURCE_EXTENSIONS.has(path.extname(source).toLowerCase())) return null;
  argv[2] = source;
  return argv;
}

/** Derive only explicitly allowlisted, shell-free manifest commands. */
export async function deriveProjectEvidencePlan(repositoryPath) {
  const root = await fs.realpath(path.resolve(repositoryPath));
  let metadata;
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    metadata = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { metadata = null; }
  const steps = [];
  const rejected = [];
  const scripts = metadata?.scripts && typeof metadata.scripts === 'object' && !Array.isArray(metadata.scripts) ? metadata.scripts : {};
  for (const key of [...SAFE_MANIFEST_KEYS].sort()) {
    if (!(key in scripts)) continue;
    const argv = splitArgv(scripts[key]);
    if (!argv) { rejected.push({ key, reason: 'unsafe_or_unallowlisted_command' }); continue; }
    const sourcePath = path.resolve(root, argv[2]);
    let resolved;
    try { resolved = await fs.realpath(sourcePath); } catch { rejected.push({ key, reason: 'missing_or_unsafe_source' }); continue; }
    if (!within(root, resolved) || !(await fs.stat(resolved)).isFile()) { rejected.push({ key, reason: 'missing_or_unsafe_source' }); continue; }
    steps.push({ argv, purpose: `manifest:${key}`, cwd: root });
  }
  return { version: 1, repositoryPath: root, kind: metadata ? 'node' : 'unknown', status: steps.length ? 'ELIGIBLE' : 'NOT_EXECUTED_UNSAFE', steps, rejected };
}

async function copyToStaging(root, artifactPaths = []) {
  const staging = await fs.mkdtemp(path.join('/tmp', `product-factory-${randomUUID()}-`));
  const preserved = new Set((artifactPaths || [])
    .filter((value) => typeof value === 'string' && !path.isAbsolute(value))
    .map((value) => path.resolve(root, value))
    .filter((value) => within(root, value)));
  await fs.cp(root, staging, {
    recursive: true,
    dereference: false,
    filter: async (source) => {
      const relative = path.relative(root, source);
      const ignored = relative && [...IGNORED_DIRECTORIES].some((name) => relative === name || relative.startsWith(`${name}${path.sep}`));
      const retainedForArtifact = [...preserved].some((candidate) => candidate === source || candidate.startsWith(`${source}${path.sep}`));
      if (ignored && !retainedForArtifact) return false;
      const stat = await fs.lstat(source);
      return !stat.isSymbolicLink();
    }
  });
  return staging;
}

/** Execute a derived project probe only in a temporary copy and clean it up. */
export async function executeStagedFactoryProbe(repositoryPath, options = {}) {
  const root = await fs.realpath(path.resolve(repositoryPath));
  const plan = await deriveProjectEvidencePlan(root);
  if (plan.status !== 'ELIGIBLE') return { plan, execution: { version: 1, repositoryPath: root, status: 'NOT_EXECUTED_UNSAFE', results: [], externalSideEffects: false }, artifacts: { version: 1, repositoryPath: root, artifacts: [], externalSideEffects: false } };
  const paths = Array.isArray(options.artifactPaths) ? options.artifactPaths.slice(0, 32) : [];
  const staging = await copyToStaging(root, paths);
  try {
    const stagedPlan = { ...plan, repositoryPath: staging, steps: plan.steps.map((step) => ({ ...step, cwd: staging })) };
    const execution = await executeFactoryPlan(stagedPlan, options);
    const artifacts = await collectArtifactEvidence(staging, paths, execution.results.map((item) => item.purpose));
    return { plan, execution: { ...execution, repositoryPath: root }, artifacts: { ...artifacts, repositoryPath: root } };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

async function validateCommand(step, root) {
  if (!step || !Array.isArray(step.argv) || step.argv.length === 0 || step.argv.some((v) => typeof v !== 'string')) throw new Error('command must be a non-empty argv array');
  const [binary, ...args] = step.argv;
  if (binary.includes('/') || binary.includes('\\')) throw new Error(`disallowed command: ${binary}`);
  if (args.some((arg) => /[;&|`$<>]/.test(arg))) throw new Error('shell metacharacters are not allowed');
  const requestedCwd = path.resolve(step.cwd || root);
  let cwd;
  try { cwd = await fs.realpath(requestedCwd); } catch { throw new Error('command cwd does not exist'); }
  if (!within(root, cwd)) throw new Error('command cwd escapes repository');

  if (binary === 'node' && args[0] === '--check' && args.length === 2) {
    const source = args[1].replaceAll('\\', '/');
    if (!source || source.startsWith('/') || source.split('/').includes('..') || !SAFE_MANIFEST_SOURCE_EXTENSIONS.has(path.extname(source).toLowerCase())) throw new Error('node syntax-check source is not a safe relative JavaScript path');
    const sourcePath = path.resolve(cwd, source);
    if (!within(root, sourcePath)) throw new Error('node syntax-check source escapes repository');
    let resolved;
    try { resolved = await fs.realpath(sourcePath); } catch { throw new Error('node syntax-check source does not exist'); }
    if (!within(root, resolved)) throw new Error('node syntax-check source escapes repository');
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) throw new Error('node syntax-check source is not a file');
    return { binary, args: ['--check', path.relative(cwd, resolved).replaceAll(path.sep, '/')], cwd };
  }

  if (binary === 'python3' && args.length === 3 && args[0] === '-B' && args[1] === '-c' && args[2] === INTERNAL_PYTHON_SYNTAX_SCRIPT) return { binary, args, cwd };
  if (binary === INTERNAL_STATIC_VALIDATION_ARGV[0] && args.length === 1 && args[0] === INTERNAL_STATIC_VALIDATION_ARGV[1]) return { binary, args, cwd };
  throw new Error(`disallowed command: ${binary}`);
}

export async function executeFactoryPlan(plan, options = {}) {
  const root = await fs.realpath(path.resolve(plan.repositoryPath));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = options.maxOutput ?? DEFAULT_MAX_OUTPUT;
  const spawnProcess = options.spawnImpl ?? spawn;
  const results = [];
  for (const step of plan.steps || []) {
    const { binary, args, cwd } = await validateCommand(step, root);
    if (options.seatbeltCapability) {
      if (!isSeatbeltCapabilityUsable(options.seatbeltCapability)) {
        return { version: 1, repositoryPath: root, status: 'NOT_EXECUTED_UNSAFE', results, externalSideEffects: false, sandbox: options.seatbeltCapability };
      }
      let sandboxResult;
      try {
        sandboxResult = await invokeSystemAgenticSeatbelt({
          tool: 'workspace_exec', workspace: cwd, execution_policy: 'READ_ONLY',
          arguments: { argv: [binary, ...args], timeout_seconds: Math.min(120, Math.max(1, Math.ceil(timeoutMs / 1000))) }
        }, options);
      } catch (error) {
        sandboxResult = { execution_status: 'FAILED', stderr: redact(error?.message || error) };
      }
      const status = sandboxResult?.execution_status === 'COMPLETED' && sandboxResult?.exit_code === 0 ? 'SUCCEEDED'
        : sandboxResult?.execution_status === 'TIMED_OUT' ? 'TIMEOUT' : 'FAILED';
      results.push({ argv: [binary, ...args], cwd, purpose: step.purpose, status, exitCode: sandboxResult?.exit_code ?? null, stdout: redact(sandboxResult?.stdout), stderr: redact(sandboxResult?.stderr), sandbox: 'system-agentic-seatbelt' });
      if (status !== 'SUCCEEDED') break;
      continue;
    }
    const result = await new Promise((resolve) => {
      const child = spawnProcess(binary, args, { cwd, shell: false, env: { PATH: process.env.PATH || '' } });
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
  return { version: 1, repositoryPath: root, status: results.every((r) => r.status === 'SUCCEEDED') ? 'SUCCEEDED' : 'FAILED', results, externalSideEffects: false, ...(options.seatbeltCapability ? { sandbox: options.seatbeltCapability } : {}) };
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
