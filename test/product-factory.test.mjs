import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyRepository, createFactoryPlan, executeFactoryPlan, collectArtifactEvidence, discoverArtifactCandidates, redact } from '../src/product-factory.mjs';

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
  await assert.rejects(() => executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['echo', 'x'], cwd: path.join(root, '..') }] }), /escapes/);
});

test('records timeout and failure', async () => {
  const root = await fixture({ 'hang.mjs': 'setTimeout(() => {}, 1000);', 'fail.mjs': 'process.exit(3);' });
  const timeout = await executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['node', 'hang.mjs'], cwd: root }] }, { timeoutMs: 20 });
  assert.equal(timeout.results[0].status, 'TIMEOUT');
  const failure = await executeFactoryPlan({ repositoryPath: root, steps: [{ argv: ['node', 'fail.mjs'], cwd: root }] });
  assert.equal(failure.results[0].status, 'FAILED');
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
