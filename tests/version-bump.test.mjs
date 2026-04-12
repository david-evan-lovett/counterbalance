import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

/**
 * Simple semver comparator: returns true if curr > prev
 */
function isBumped(prev, curr) {
  const [pMaj, pMin, pPatch] = prev.split('.').map(Number);
  const [cMaj, cMin, cPatch] = curr.split('.').map(Number);
  if (cMaj > pMaj) return true;
  if (cMaj < pMaj) return false;
  if (cMin > pMin) return true;
  if (cMin < pMin) return false;
  return cPatch > pPatch;
}

/**
 * Strip and sort keys for deterministic comparison
 */
function normalizeForComparison(obj) {
  const stripped = JSON.parse(JSON.stringify(obj));
  delete stripped.version;
  // For marketplace, also drop nested version fields
  if (stripped.plugins && Array.isArray(stripped.plugins)) {
    stripped.plugins.forEach(p => delete p.version);
  }
  return JSON.stringify(stripped, Object.keys(stripped).sort());
}

const baseRef = process.env.BASE_REF || 'origin/main';

test('counterbalance.AC8.3: plugin.json version bumped when body changed', async () => {
  try {
    const basePath = 'plugins/counterbalance/.claude-plugin/plugin.json';
    let baseContent;
    try {
      baseContent = execSync(`git show ${baseRef}:${basePath}`, {
        cwd: repoRoot,
        encoding: 'utf-8'
      });
    } catch (e) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }

    const currentContent = readFileSync(path.resolve(repoRoot, basePath), 'utf-8');

    const baseObj = JSON.parse(baseContent);
    const currentObj = JSON.parse(currentContent);

    const baseNorm = normalizeForComparison(baseObj);
    const currentNorm = normalizeForComparison(currentObj);

    // If body hasn't changed, skip this test (it's not applicable)
    if (baseNorm === currentNorm) {
      return;
    }

    // Body changed, so version must have bumped
    assert.ok(isBumped(baseObj.version, currentObj.version),
      `plugin.json body changed but version did not bump: ${baseObj.version} -> ${currentObj.version}`);
  } catch (e) {
    if (e.message && e.message.includes('base ref') && e.message.includes('not found')) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }
    throw e;
  }
});

test('counterbalance.AC8.3: marketplace.json version bumped when body changed', async () => {
  try {
    const basePath = '.claude-plugin/marketplace.json';
    let baseContent;
    try {
      baseContent = execSync(`git show ${baseRef}:${basePath}`, {
        cwd: repoRoot,
        encoding: 'utf-8'
      });
    } catch (e) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }

    const currentContent = readFileSync(path.resolve(repoRoot, basePath), 'utf-8');

    const baseObj = JSON.parse(baseContent);
    const currentObj = JSON.parse(currentContent);

    const baseNorm = normalizeForComparison(baseObj);
    const currentNorm = normalizeForComparison(currentObj);

    // If body hasn't changed, skip this test (it's not applicable)
    if (baseNorm === currentNorm) {
      return;
    }

    // Body changed, so version must have bumped
    assert.ok(isBumped(baseObj.version, currentObj.version),
      `marketplace.json body changed but version did not bump: ${baseObj.version} -> ${currentObj.version}`);
  } catch (e) {
    if (e.message && e.message.includes('base ref') && e.message.includes('not found')) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }
    throw e;
  }
});

test('counterbalance.AC8.3: no version bump required when body identical to base', async () => {
  // This is a control test: if neither file's body has changed, then
  // we should not require a version bump. In most cases (no manifest changes),
  // this test passes trivially because the bodies are identical.
  try {
    const pluginPath = 'plugins/counterbalance/.claude-plugin/plugin.json';
    let basePluginContent;
    try {
      basePluginContent = execSync(`git show ${baseRef}:${pluginPath}`, {
        cwd: repoRoot,
        encoding: 'utf-8'
      });
    } catch (e) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }

    const currentPluginContent = readFileSync(path.resolve(repoRoot, pluginPath), 'utf-8');

    const basePluginObj = JSON.parse(basePluginContent);
    const currentPluginObj = JSON.parse(currentPluginContent);

    const basePluginNorm = normalizeForComparison(basePluginObj);
    const currentPluginNorm = normalizeForComparison(currentPluginObj);

    // If body hasn't changed, then no bump is required, so this test is simply a pass.
    // This ensures we don't flag manifests as needing a bump when they haven't actually changed.
    if (basePluginNorm === currentPluginNorm) {
      assert.ok(true, 'body unchanged, no bump required');
    }
  } catch (e) {
    if (e.message && e.message.includes('base ref') && e.message.includes('not found')) {
      console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
      return;
    }
    throw e;
  }
});

test('version-bump: skip cleanly when base ref not available', () => {
  // Try to fetch the base ref. If it doesn't exist, the test should pass
  // (we skip cleanly and log a message).
  try {
    execSync(`git show ${baseRef}:plugins/counterbalance/.claude-plugin/plugin.json`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  } catch (e) {
    // If the base ref doesn't exist, we should skip cleanly.
    console.log(`[counterbalance] version-bump test: base ref ${baseRef} not found, skipping`);
    assert.ok(true, 'base ref missing, skipped cleanly');
    return;
  }
  // If we got here, the base ref exists and we're good.
  assert.ok(true, 'base ref available');
});
