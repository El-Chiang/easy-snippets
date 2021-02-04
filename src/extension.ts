import * as vscode from 'vscode';
import createEsnp from './createEsnp';
import { EasySnippetsProvider, Snippet } from './easySnippets';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "easy-snippets" is now active!');

  // const workspaceFolders = vscode.workspace.workspaceFolders;
  // const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
  const configPath = vscode.workspace.getConfiguration('easySnippets').workspaceFolder;
  const easySnippetsProvider = new EasySnippetsProvider(configPath);

  vscode.window.registerTreeDataProvider('easySnippets', easySnippetsProvider);
  vscode.commands.registerCommand('easySnippets.refreshEntry', () => easySnippetsProvider.refresh());
  vscode.commands.registerCommand('easySnippets.syncItem', (snippet: Snippet) => easySnippetsProvider.syncItem(snippet));
  vscode.commands.registerCommand('easySnippets.syncAll', () => easySnippetsProvider.syncAll());
  vscode.commands.registerCommand('easySnippets.createEsnp', async () => {
    const dirPath: string | null = vscode.workspace.getConfiguration().get('easySnippets.workspaceFolder') || null;
    const result: vscode.Uri | void = await createEsnp();
    if (result) {
      easySnippetsProvider.refresh();
      easySnippetsProvider.openResource(result);
      vscode.window.showInformationMessage('Create .esnp file successfully!');
    } 
  });
  vscode.commands.registerCommand('easySnippets.setWorkspaceFolder', async () => {
    await easySnippetsProvider.setWorkspaceFolder();
    easySnippetsProvider.refresh();
    vscode.window.showInformationMessage('Set workspace folder of easy-snippets successfully!');
  });
  // context.subscriptions.push(createItem);
}

export function deactivate() { }
