'use strict';

// Runs the integration tests in a separate VS Code instance, with no dependency to install:
//
//   FOXIFY_PATH=/path/to/foxify FOXIFY_EXAMPLES=/path/to/foxify/docs node test/integration/run.js
//
// FOXIFY_EXAMPLES is the docs folder of the foxify repository (example/api, example/workflows and
// environment.yaml); the Foxify test server must be running on http://localhost:5122.
// VS Code is found next to the `code` command on the PATH, or set VSCODE_PATH to its executable.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const examples = process.env.FOXIFY_EXAMPLES;
if (!process.env.FOXIFY_PATH || !examples) {
  console.error('Set FOXIFY_PATH (the foxify binary) and FOXIFY_EXAMPLES (the docs folder of the foxify repository).');
  process.exit(2);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'foxify-vscode-'));
const workspace = path.join(temp, 'workspace');
fs.cpSync(path.join(examples, 'example'), workspace, { recursive: true });
fs.copyFileSync(path.join(examples, 'environment.yaml'), path.join(workspace, 'environment.yaml'));
// Set before VS Code starts, so the extension uses this binary from its activation.
fs.mkdirSync(path.join(workspace, '.vscode'));
fs.writeFileSync(path.join(workspace, '.vscode', 'settings.json'), JSON.stringify({ 'foxify.path': process.env.FOXIFY_PATH }, null, 2));

const extension = path.resolve(__dirname, '..', '..');
const code = process.env.VSCODE_PATH || findVsCode();
const result = spawnSync(code, [
  workspace,
  `--extensionDevelopmentPath=${extension}`,
  `--extensionTestsPath=${path.join(__dirname, 'index.js')}`,
  `--user-data-dir=${path.join(temp, 'user-data')}`,
  `--extensions-dir=${path.join(temp, 'extensions')}`,
  '--disable-workspace-trust',
  '--skip-welcome',
  '--new-window'
], { stdio: 'inherit', env: withoutRunAsNode(process.env) });

const report = path.join(workspace, 'integration-results.txt');
if (fs.existsSync(report)) console.log(fs.readFileSync(report, 'utf8'));
else console.error('No results: VS Code did not run the tests.');

try {
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
} catch {
  // VS Code may still hold a file for a moment; the folder is in the temp directory anyway.
}
process.exit(result.status ?? 1);

/** Started from a VS Code terminal, ELECTRON_RUN_AS_NODE would make VS Code start as plain Node. */
function withoutRunAsNode(env) {
  const copy = { ...env };
  delete copy.ELECTRON_RUN_AS_NODE;
  return copy;
}

/**
 * The VS Code executable, not the `code` launcher: the launcher hands the window over to
 * the running VS Code and exits at once, before the tests have run.
 */
function findVsCode() {
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['code'], { encoding: 'utf8' });
  const launcher = (which.stdout ?? '').split('\n').map(line => line.trim()).find(Boolean);
  if (!launcher) {
    console.error('VS Code not found: set VSCODE_PATH to its executable.');
    process.exit(2);
  }
  const install = path.resolve(path.dirname(fs.realpathSync(launcher)), '..');
  const candidates = process.platform === 'win32'
    ? [path.join(install, 'Code.exe')]
    : process.platform === 'darwin'
      ? [path.resolve(install, '..', 'MacOS', 'Electron'), path.resolve(install, '..', 'MacOS', 'Code')]
      : [path.join(install, 'code'), path.resolve(install, '..', 'code')];
  return candidates.find(fs.existsSync) ?? launcher;
}
