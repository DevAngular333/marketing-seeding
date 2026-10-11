import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("runtime token ACL excludes broad local user groups", { skip: process.platform !== "win32" }, async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "seeding-acl-"));
  const tokenFile = path.join(dataDir, "operator-token");
  await writeFile(tokenFile, "fixture-secret-never-logged", "utf8");

  const aclScript = path.join(projectRoot, "scripts", "Set-PrivateRuntimeAcl.ps1");
  const apply = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", aclScript, "-Path", tokenFile], { encoding: "utf8" });
  assert.equal(apply.status, 0, apply.stderr);

  const inspect = spawnSync("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    `$acl=Get-Acl -LiteralPath '${tokenFile.replaceAll("'", "''")}'; $owner=([Security.Principal.NTAccount]::new($acl.Owner)).Translate([Security.Principal.SecurityIdentifier]).Value; [pscustomobject]@{protected=$acl.AreAccessRulesProtected;owner=$owner;sids=@($acl.Access|ForEach-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value})}|ConvertTo-Json -Compress`
  ], { encoding: "utf8" });
  assert.equal(inspect.status, 0, inspect.stderr);
  const acl = JSON.parse(inspect.stdout.trim());
  assert.equal(acl.protected, true);
  assert.ok(acl.sids.includes(acl.owner));
  assert.ok(acl.sids.includes("S-1-5-18"));
  assert.ok(acl.sids.includes("S-1-5-32-544"));
  assert.equal(acl.sids.includes("S-1-1-0"), false);
  assert.equal(acl.sids.includes("S-1-5-11"), false);
  assert.equal(acl.sids.includes("S-1-5-32-545"), false);
});

test("browser evidence directory and existing screenshots exclude broad local user groups", { skip: process.platform !== "win32" }, async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "seeding-evidence-acl-"));
  const evidenceDir = path.join(dataDir, "evidence");
  const screenshotFile = path.join(evidenceDir, "fixture.png");
  await mkdir(evidenceDir);
  await writeFile(screenshotFile, "fixture screenshot", "utf8");

  const aclScript = path.join(projectRoot, "scripts", "Set-PrivateRuntimeAcl.ps1");
  const apply = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", aclScript, "-Path", evidenceDir], { encoding: "utf8" });
  assert.equal(apply.status, 0, apply.stderr);

  const inspect = spawnSync("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    `@('${evidenceDir.replaceAll("'", "''")}','${screenshotFile.replaceAll("'", "''")}')|ForEach-Object{$acl=Get-Acl -LiteralPath $_;[pscustomobject]@{protected=$acl.AreAccessRulesProtected;sids=@($acl.Access|ForEach-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value})}}|ConvertTo-Json -Compress`
  ], { encoding: "utf8" });
  assert.equal(inspect.status, 0, inspect.stderr);
  const entries = JSON.parse(inspect.stdout.trim());
  for (const acl of entries) {
    assert.equal(acl.protected, true);
    assert.ok(acl.sids.includes("S-1-5-18"));
    assert.ok(acl.sids.includes("S-1-5-32-544"));
    assert.equal(acl.sids.includes("S-1-1-0"), false);
    assert.equal(acl.sids.includes("S-1-5-11"), false);
    assert.equal(acl.sids.includes("S-1-5-32-545"), false);
  }
});
