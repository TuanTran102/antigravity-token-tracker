import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Extension Manifest & Config', () => {
  it('should have valid package.json with activationEvents and contributes', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    assert.strictEqual(fs.existsSync(pkgPath), true, 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(pkg.name, 'antigravity-token-tracker');
    assert.strictEqual(pkg.engines?.vscode, '^1.90.0');
    assert.ok(pkg.contributes?.viewsContainers?.activitybar);
    assert.ok(pkg.contributes?.views?.['antigravity-token-tracker-explorer']);
    assert.ok(pkg.contributes?.configuration?.properties?.['antigravityTokenTracker.brainPath']);
  });
});
