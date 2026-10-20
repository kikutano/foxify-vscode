'use strict';

const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs');
const cli = require('./cli');
const protocol = require('./protocol');

const INSTALL_URL = 'https://github.com/kikutano/foxify#install';
const ENVIRONMENT_KEY = 'foxify.environment';
const IGNORED_FOLDERS = '**/{node_modules,bin,obj,.git}/**';

/**
 * What every feature shares: the binary and its settings, the output channel,
 * the selected environment file and the --var variables.
 */
class Foxify {
  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.context = context;
    this.output = vscode.window.createOutputChannel('Foxify');
    this.warned = new Set();

    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.status.command = 'foxify.selectEnvironment';
    this.updateStatus();
    this.status.show();
  }

  dispose() {
    this.output.dispose();
    this.status.dispose();
  }

  command() {
    return vscode.workspace.getConfiguration('foxify').get('path') || 'foxify';
  }

  /** foxify runs in the workspace folder, so the locations it reports are relative to it. */
  cwdFor(uri) {
    return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(uri.fsPath);
  }

  /** Options of run and call: the environment file and the variables of the settings. */
  runOptions() {
    return {
      environment: this.environment(),
      variables: vscode.workspace.getConfiguration('foxify').get('variables') ?? {}
    };
  }

  log(message) {
    this.output.appendLine(message);
  }

  /** Shows a problem with the binary once per session, with a way to fix it. */
  async reportError(error) {
    this.log(String(error.message ?? error));
    if (!(error instanceof cli.FoxifyNotFoundError)) {
      vscode.window.showErrorMessage(`Foxify: ${error.message ?? error}`);
      return;
    }
    if (this.warned.has('missing')) return;
    this.warned.add('missing');

    const choice = await vscode.window.showWarningMessage(
      `Foxify CLI not found ('${error.command}'). Install it, or set its path in the settings.`,
      'How to install', 'Open settings');
    if (choice === 'How to install') vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
    if (choice === 'Open settings') vscode.commands.executeCommand('workbench.action.openSettings', 'foxify.path');
  }

  /** Warns, once, when the binary is too old or speaks a newer protocol than this extension. */
  async checkVersion() {
    let result;
    try {
      result = await cli.execute(this.command(), ['--version']);
    } catch (error) {
      this.reportError(error);
      return;
    }

    const version = result.stdout.trim();
    this.log(`Using foxify ${version} (${this.command()})`);
    if (!protocol.isSupportedVersion(version)) {
      vscode.window.showWarningMessage(
        `This extension needs Foxify ${protocol.MINIMUM_VERSION} or newer, and found ${version}. Run 'foxify update'.`);
    }
  }

  checkProtocol(json) {
    if (json.protocol > protocol.SUPPORTED_PROTOCOL && !this.warned.has('protocol')) {
      this.warned.add('protocol');
      vscode.window.showWarningMessage(
        `Foxify ${json.version} speaks protocol ${json.protocol}; this extension knows protocol ${protocol.SUPPORTED_PROTOCOL}. Update the extension.`);
    }
  }

  // --- Environment -----------------------------------------------------------

  /** The selected environment file, if it still exists. */
  environment() {
    const file = this.context.workspaceState.get(ENVIRONMENT_KEY);
    return file && fs.existsSync(file) ? file : undefined;
  }

  updateStatus() {
    const file = this.environment();
    this.status.text = `$(server-environment) ${file ? path.basename(file) : 'No environment'}`;
    this.status.tooltip = file
      ? `Foxify environment: ${vscode.workspace.asRelativePath(file)}\nClick to change it`
      : 'Foxify: select the environment file passed with -e';
  }

  async selectEnvironment() {
    const files = (await vscode.workspace.findFiles('**/*.{yaml,yml}', IGNORED_FOLDERS))
      .filter(uri => protocol.isEnvironmentFileName(uri.fsPath))
      .sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    const current = this.environment();

    const items = [
      { label: 'No environment', description: 'run without -e', file: undefined },
      ...files.map(uri => ({
        label: path.basename(uri.fsPath),
        description: vscode.workspace.asRelativePath(path.dirname(uri.fsPath)),
        file: uri.fsPath
      }))
    ].map(item => ({ ...item, picked: item.file === current }));

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Foxify environment',
      placeHolder: files.length === 0 ? 'No env*.yaml file found in the workspace' : 'The file passed with -e to every run and call'
    });
    if (!picked) return;

    await this.context.workspaceState.update(ENVIRONMENT_KEY, picked.file);
    this.updateStatus();
  }
}

module.exports = { Foxify, IGNORED_FOLDERS };
