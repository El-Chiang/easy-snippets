import * as vscode from 'vscode';
import * as path from 'path';
import { EasySnippetsParser } from './parser';
import { _ } from './utils';

export default async function createEsnp(): Promise<vscode.Uri | void> {
  const fileUri: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select folder to create .esnp file in',
    canSelectFiles: false,
    canSelectFolders: true
  });

  if (!fileUri?.length) {
    return;
  }

  const dirPath: string = fileUri[0].fsPath;
  const fileName = await vscode.window.showInputBox({
    prompt: `Enter the name for your .esnp file`,
    placeHolder: 'File name',
    validateInput: (value: string) => {
      return value?.length ? null : 'File name can not be empty!';
    }
  });
  if (!fileName) {
    return;
  }

  const prefix: string | undefined = await vscode.window.showInputBox({
    prompt: 'Enter the prefix of code snippets',
    placeHolder: 'preifx',
    validateInput: (value: string) => {
      return value?.length ? null : 'Prefix can not be empty!';
    }
  });
  if (!prefix) {
    return;
  }

  const title: string | undefined = await vscode.window.showInputBox({
    prompt: 'Enter the title of code snippets',
    placeHolder: 'Prefix by default',
    value: prefix,
  });
  if (!title) {
    return;
  }

  const description: string | undefined = await vscode.window.showInputBox({
    prompt: 'Enter the description of code snippets',
    placeHolder: 'description',
    validateInput: (value: string) => {
      return value?.length ? null : 'Description can not be empty!';
    }
  });
  if (!description) {
    return;
  }

  const scope: string | undefined = await vscode.window.showInputBox({
    prompt: 'Enter the scope of code snippets',
    placeHolder: 'e.g. javascript,typescript (If scope is empty, it takes effect for global)'
  });

  try {
    const fsPath = path.join(dirPath, `${fileName}.esnp`);
    const parser = new EasySnippetsParser(prefix, '', fsPath, description, scope);
    const template = parser.template();
    await _.writefile(fsPath, template);
    const uri: vscode.Uri = vscode.Uri.file(parser.fsPath);
    return uri;
  } catch (err) {
    vscode.window.showErrorMessage(`Create file failed: ${err.message}`);
    console.error(err.message);
  }
}
