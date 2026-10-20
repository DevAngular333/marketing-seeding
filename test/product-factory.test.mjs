import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { classifyRepository, createFactoryPlan, executeFactoryPlan, collectArtifactEvidence, discoverArtifactCandidates, deriveProjectEvidencePlan, executeStagedFactoryProbe, evaluateFactorySandboxCapability, probeFactorySandboxCapability, probeSystemAgenticSeatbeltCapability, projectFactoryRunEvidence, redact } from '../src/product-factory.mjs';

async function fixture(files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'product-factory-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content);
  }
  return root;
}

test('classifies node, python, static and unknown deterministically', async () => {
  assert.equal((await classifyRepository(await fixture({ 'package.json': '{}' }))).kind, 'node');
  assert.equal((await classifyRepository(await fixture({ 'pyproject.toml': '' }))).kind, 'python');
  assert.equal((await classifyRepository(await fixture({ 'index.html': '<h1>x</h1>' }))).kind, 'static');
  assert.equal((await classifyRepository(await fixture({ 'README.md': 'x' }))).kind, 'unknown');
});

test('System-Agentic Seatbelt adapter is read-only and remains fail-closed without attestation', async () => {
  const root = await fixture();
  const result = await probeSystemAgenticSeatbeltCapability({ runtimeRoot: root });
  assert.equal(result.backend, 'system-agentic-seatbelt');
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.executionEligible, false);
  assert.equal(result.unsafeCommandDisposition, 'NOT_EXECUTED_UNSAFE');
  const available = await probeSystemAgenticSeatbeltCapability({ runtimeRoot: root, backendPresent: true });
  assert.equal(available.status, 'UNSUPPORTED');
  assert.equal(available.executionEligible, false);
});

test('plan is deterministic and runner executes without shell', async () => {
  const root = await fixture({ 'package.json': '{}', 'src/server.mjs': '' });
  const plan = createFactoryPlan(await classifyRepository(root));
  assert.deepEqual(plan, createFactoryPlan(await classifyRepository(root)));
  const run = await executeFactoryPlan(plan);
  assert.equal(run.status, 'SUCCEEDED'); assert.equal(run.externalSideEffects, false);
});

test('rejects traversal and disallowed commands', async () => {
  const root = await fixture();
  await assert.rejects(() => executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['sh', '-c', 'echo bad'], cwd: root }] }), /disallowed/);
  await assert.rejects(() => executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['node', 'script.mjs'], cwd: root }] }), /disallowed/);
  await assert.rejects(() => executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['node', '--check', 'missing.mjs'], cwd: root }] }), /does not exist/);
  await assert.rejects(() => executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['echo', 'x'], cwd: path.join(root, '..') }] }), /escapes/);
});

test('records timeout and failure for the bounded runner', async () => {
  const root = await fixture({ 'bad.mjs': 'export = ;' });
  const failure = await executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['node', '--check', 'bad.mjs'], cwd: root }] });
  assert.equal(failure.results[0].status, 'FAILED');
  const timeout = await executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['echo', 'static-artifact-ready'], cwd: root }] }, {
    timeoutMs: 20,
    spawnImpl(binary, args, options) {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setTimeout(() => child.emit('close', null, 'SIGTERM'), 50);
      return child;
    }
  });
  assert.equal(timeout.results[0].status, 'TIMEOUT');
});

test('hashes artifacts and redacts secret-like output', async () => {
  const root = await fixture({ 'dist/out.txt': 'hello' });
  const evidence = await collectArtifactEvidence(root, ['dist/out.txt'], 'step-1');
  assert.equal(evidence.artifacts[0].sha256.length, 64); assert.equal(evidence.artifacts[0].commandRef, 'step-1');
  assert.match(redact('token=abc123 password=hunter2'), /token=\[REDACTED\].*password=\[REDACTED\]/);
});

test('artifact evidence rejects symlink escape', async () => {
  const root = await fixture({ 'dist/out.txt': 'inside' });
  const outside = await fixture({ 'outside.txt': 'outside' });
  await fs.symlink(path.join(outside, 'outside.txt'), path.join(root, 'dist', 'link.txt'));
  await assert.rejects(() => collectArtifactEvidence(root, ['dist/link.txt']), /escapes/);
});

test('discovers bounded artifact candidates deterministically and skips generated directories', async () => {
  const root = await fixture({
    'media/demo.mp4': 'video',
    'media/cover.png': 'image',
    'node_modules/ignored.mp4': 'ignored',
    'dist/generated.zip': 'ignored'
  });
  const first = await discoverArtifactCandidates(root);
  const second = await discoverArtifactCandidates(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.candidates.map((item) => item.path), ['media/cover.png', 'media/demo.mp4']);
  assert.equal(first.externalSideEffects, false);
});

test('artifact discovery bounds count and bytes', async () => {
  const root = await fixture({ 'a.bin': 'not-media', 'a.mp4': '1234', 'b.mp4': '5678' });
  const result = await discoverArtifactCandidates(root, { maxFiles: 1, maxBytes: 4 });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.totalBytes, 4);
});

test('python validation plan is syntax-only and does not create cache files', async () => {
  const root = await fixture({ 'pyproject.toml': '', 'main.py': 'print("ok")\n' });
  const plan = createFactoryPlan(await classifyRepository(root));
  const result = await executeFactoryPlan(plan);
  assert.equal(result.status, 'SUCCEEDED');
  assert.deepEqual((await fs.readdir(root)).sort(), ['main.py', 'pyproject.toml']);
});

test('derives deterministic safe manifest plan and rejects shell commands', async () => {
  const root = await fixture({ 'package.json': JSON.stringify({ scripts: { build: 'node --check build.mjs', render: 'npm install && echo nope' } }), 'build.mjs': 'console.log("ok")' });
  const plan = await deriveProjectEvidencePlan(root);
  assert.deepEqual(plan, await deriveProjectEvidencePlan(root));
  assert.equal(plan.status, 'ELIGIBLE');
  assert.deepEqual(plan.steps[0].argv, ['node', '--check', 'build.mjs']);
  assert.deepEqual(plan.rejected, [{ key: 'render', reason: 'unsafe_or_unallowlisted_command' }]);
});

test('staged probe isolates source and reports bounded artifacts', async () => {
  const root = await fixture({ 'package.json': JSON.stringify({ scripts: { build: 'node --check build.mjs' } }), 'build.mjs': 'console.log("syntax only")', 'media/out.png': 'fixture' });
  const result = await executeStagedFactoryProbe(root, { artifactPaths: ['media/out.png'] });
  assert.equal(result.execution.status, 'SUCCEEDED');
  assert.equal(result.execution.externalSideEffects, false);
  assert.equal(result.artifacts.artifacts[0].bytes, 7);
  assert.equal(await fs.readFile(path.join(root, 'media', 'out.png'), 'utf8'), 'fixture');
});

test('manifest execution fails closed for scripts, interpreters, package managers and unsafe paths', async () => {
  const root = await fixture({ 'package.json': JSON.stringify({ scripts: {
    build: 'node build.mjs',
    test: 'node -e "process.exit(1)"',
    render: 'python script.py',
    validate: 'npm run build'
  } }), 'build.mjs': 'console.log("unsafe")', 'script.py': 'print("unsafe")' });
  const plan = await deriveProjectEvidencePlan(root);
  assert.equal(plan.status, 'NOT_EXECUTED_UNSAFE');
  assert.deepEqual(plan.steps, []);
  assert.deepEqual(plan.rejected.map((item) => item.key), ['build', 'render', 'test', 'validate']);
});

test('manifest accepts only a relative JavaScript syntax check and rejects traversal or absolute paths', async () => {
  const root = await fixture({ 'package.json': JSON.stringify({ scripts: {
    build: 'node --check src/build.mjs',
    test: 'node --check ../outside.mjs',
    render: 'node --check /tmp/render.mjs',
    validate: 'node --check src/build.ts'
  } }), 'src/build.mjs': 'export const ok = true;' });
  const plan = await deriveProjectEvidencePlan(root);
  assert.equal(plan.status, 'ELIGIBLE');
  assert.deepEqual(plan.steps.map((step) => step.argv), [['node', '--check', 'src/build.mjs']]);
  assert.deepEqual(plan.rejected.map((item) => item.key), ['render', 'test', 'validate']);
});

test('missing manifest truthfully remains unexecuted', async () => {
  const root = await fixture({ 'README.md': 'fixture' });
  const result = await executeStagedFactoryProbe(root);
  assert.equal(result.plan.status, 'NOT_EXECUTED_UNSAFE');
  assert.equal(result.execution.status, 'NOT_EXECUTED_UNSAFE');
});

test('sandbox preflight fails closed when the backend is unavailable', async () => {
  const result = await probeFactorySandboxCapability({ backendPath: '/tmp/does-not-exist', backendPresent: false });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.executionEligible, false);
  assert.equal(result.checks.backendInvocation, 'UNAVAILABLE');
  assert.equal(result.unsafeCommandDisposition, 'NOT_EXECUTED_UNSAFE');
});

test('sandbox preflight distinguishes backend invocation from an audited profile', async () => {
  const result = await probeFactorySandboxCapability({
    backend: 'synthetic-backend',
    backendPresent: true,
    invoke: async () => ({ ok: true, status: 'PASS' })
  });
  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.executionEligible, false);
  assert.equal(result.checks.backendInvocation, 'PASS');
  assert.equal(result.checks.profileIntegrity, 'UNSUPPORTED');
  assert.equal(result.checks.resourceLimits, 'UNSUPPORTED');
});

test('sandbox preflight output is deterministic and only all proven checks can enable execution', async () => {
  const checks = {
    profileIntegrity: 'PASS',
    networkDenied: 'PASS',
    filesystemScope: 'PASS',
    childProcessPolicy: 'PASS',
    timeoutCleanup: 'PASS',
    resourceLimits: 'PASS'
  };
  const first = evaluateFactorySandboxCapability({ backend: 'synthetic-backend', backendPresent: true, checks: { backendInvocation: 'PASS', ...checks } });
  const second = evaluateFactorySandboxCapability({ backend: 'synthetic-backend', backendPresent: true, checks: { backendInvocation: 'PASS', ...checks } });
  assert.deepEqual(first, second);
  assert.equal(first.status, 'AVAILABLE');
  assert.equal(first.executionEligible, true);
  assert.equal(first.limits.network, 'PASS');
});

test('factory evidence projection is bounded, deterministic and secret-safe', () => {
  const runs = [
    { id: 'older', campaignId: 'c1', completedAt: '2026-01-01T00:00:00Z', status: 'SUCCEEDED', externalSideEffects: false, classification: { kind: 'node', confidence: 'high' }, plan: { projectEvidence: { status: 'NOT_EXECUTED_UNSAFE' } }, execution: { status: 'NOT_EXECUTED_UNSAFE', results: [], externalSideEffects: false }, artifacts: { artifacts: [{ path: 'README.md', sha256: 'bad', bytes: 4, commandRef: 'token=secret' }] } },
    { id: 'newer', campaignId: 'c1', completedAt: '2026-01-02T00:00:00Z', status: 'SUCCEEDED', externalSideEffects: false, classification: { kind: 'static', confidence: 'medium' }, plan: { projectEvidence: { status: 'ELIGIBLE' } }, execution: { status: 'SUCCEEDED', results: [{ purpose: 'static-validation' }], externalSideEffects: false }, artifacts: { artifacts: [{ path: 'media/demo.png', sha256: 'A'.repeat(64), bytes: 8, commandRef: ['step-1'] }] }, output: 'password=do-not-project' }
  ];
  const projected = projectFactoryRunEvidence(runs, { limit: 1 });
  assert.equal(projected.length, 1);
  assert.equal(projected[0].id, 'newer');
  assert.equal(projected[0].artifacts[0].sha256, 'a'.repeat(64));
  assert.equal(Object.hasOwn(projected[0], 'output'), false);
  assert.deepEqual(projected, projectFactoryRunEvidence([...runs].reverse(), { limit: 1 }));
});
