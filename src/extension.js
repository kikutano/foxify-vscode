'use strict';

const vscode = require('vscode');
const protocol = require('./protocol');
const { Foxify } = require('./foxify');
const { Inspector } = require('./inspector');
const { RunView } = require('./runView');
const { WorkflowTests } = require('./testing');
const { EndpointCaller } = require('./call');
const { FoxifyCodeLens } = require('./codelens');

const YAML = [{ language: 'yaml', scheme: 'file' }];

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const foxify = new Foxify(context);
  const inspector = new Inspector(foxify);
  const runView = new RunView(context);
  const tests = new WorkflowTests(foxify, inspector, runView);
  const caller = new EndpointCaller(foxify, inspector, runView);
  const lenses = new FoxifyCodeLens(inspector, uri => foxify.cwdFor(uri));
  context.subscriptions.push(foxify, inspector, runView, tests, lenses);

  const isFoxify = document => document.uri.scheme === 'file' && document.languageId === 'yaml' && protocol.isFoxifyFile(document.getText());
  const validateOnSave = () => vscode.workspace.getConfiguration('foxify').get('validateOnSave');

  const validate = document => {
    if (isFoxify(document) && validateOnSave()) inspector.inspect(document.uri);
  };

  /** The editor's file, or the one a command was invoked on (CodeLens, title bar, explorer). */
  const target = uri => uri instanceof vscode.Uri ? uri : vscode.window.activeTextEditor?.document.uri;

  const updateContext = editor => {
    const isWorkflow = !!editor && editor.document.languageId === 'yaml' && protocol.isWorkflowFile(editor.document.getText());
    vscode.commands.executeCommand('setContext', 'foxify.isWorkflow', isWorkflow);
  };

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(YAML, lenses),

    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidSaveTextDocument(async document => {
      if (!isFoxify(document) || !validateOnSave()) return;
      await inspector.inspect(document.uri);
      // A saved API file can fix or break the workflows that import it.
      await inspector.inspectAll();
    }),
    // A closed file's problems go away with it, like a language server's.
    vscode.workspace.onDidCloseTextDocument(document => inspector.forget(document.uri.fsPath)),
    vscode.window.onDidChangeActiveTextEditor(updateContext),

    vscode.commands.registerCommand('foxify.runWorkflow', async uri => {
      const file = target(uri);
      if (!file) return;
      await saveIfDirty(file);
      await tests.runFile(file);
    }),
    vscode.commands.registerCommand('foxify.callEndpoint', async (uri, endpoint) => {
      const file = target(uri);
      if (!file) return;
      await saveIfDirty(file);
      await caller.call(file, typeof endpoint === 'string' ? endpoint : undefined);
    }),
    vscode.commands.registerCommand('foxify.selectEnvironment', () => foxify.selectEnvironment()),
    vscode.commands.registerCommand('foxify.showRun', () => {
      if (runView.hasRun) runView.show();
      else vscode.window.showInformationMessage('Foxify: nothing has run yet.');
    }),
    vscode.commands.registerCommand('foxify.validate', async uri => {
      const file = target(uri);
      if (!file) return;
      await saveIfDirty(file);
      const json = await inspector.inspect(file);
      if (json?.valid) vscode.window.showInformationMessage(`Foxify: ${vscode.workspace.asRelativePath(file)} is valid.`);
      else if (json) vscode.commands.executeCommand('workbench.actions.view.problems');
    })
  );

  foxify.checkVersion();
  vscode.workspace.textDocuments.forEach(validate);
  updateContext(vscode.window.activeTextEditor);

  // The extension's API, used by the integration tests.
  return { foxify, inspector, runView, tests, caller, lenses };
}

/** foxify reads files from disk: unsaved changes are saved first, as a run would expect. */
async function saveIfDirty(uri) {
  const document = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
  if (document?.isDirty) await document.save();
}

function deactivate() {}

module.exports = { activate, deactivate };
