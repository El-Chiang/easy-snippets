/**
 * @filename easySnippets.ts
 * @create 2021/01/22 12:17:53
 * @author 不狸
 * @contact junyu.junyujiang@alibaba-inc.com
 * @description 
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { EasySnippetsParser, ISnippetItem } from './parser';
import getCodeSnippetsDir from './getCodeSnippetsDir';
import { DEFAULT_FILE_NAME, SEPARATOR } from './constants';
import { pathExists, isDirectory, _ } from "./utils";

export class FileStat implements vscode.FileStat {

  constructor(private fsStat: fs.Stats) { }

  get type(): vscode.FileType {
    return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}
export class EasySnippetsProvider implements vscode.TreeDataProvider<Snippet>, vscode.FileSystemProvider {

  private _onDidChangeTreeData: vscode.EventEmitter<Snippet | undefined | void> = new vscode.EventEmitter<Snippet | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<Snippet | undefined | void> = this._onDidChangeTreeData.event;

  private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;

  constructor(private workspaceRoot: string) {
    vscode.commands.registerCommand('easySnippets.openFile', (resource) => this.openResource(resource));
    this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    // console.log('rootPath:', workspaceRoot);
  }

  get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
    const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
      const filepath = path.join(uri.fsPath, filename.toString());

      // TODO support excludes (using minimatch library?)

      this._onDidChangeFile.fire([{
        type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
        uri: uri.with({ path: filepath })
      } as vscode.FileChangeEvent]);
    });

    return { dispose: () => watcher.close() };
  }

  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    return this._stat(uri.fsPath);
  }

  async _stat(path: string): Promise<vscode.FileStat> {
    return new FileStat(await _.stat(path));
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    return this._readDirectory(uri);
  }

  async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const children = await _.readdir(uri.fsPath);

    const result: [string, vscode.FileType][] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const stat = await this._stat(path.join(uri.fsPath, child));
      result.push([child, stat.type]);
    }

    return Promise.resolve(result);
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    return _.mkdir(uri.fsPath);
  }

  readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
    return _.readfile(uri.fsPath);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
    return this._writeFile(uri, content, options);
  }

  async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
    const exists = await _.exists(uri.fsPath);
    if (!exists) {
      if (!options.create) {
        throw vscode.FileSystemError.FileNotFound();
      }

      await _.mkdir(path.dirname(uri.fsPath));
    } else {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      }
    }

    return _.writefile(uri.fsPath, content as Buffer);
  }

  delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
    if (options.recursive) {
      return _.rmrf(uri.fsPath);
    }

    return _.unlink(uri.fsPath);
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
    return this._rename(oldUri, newUri, options);
  }

  async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
    const exists = await _.exists(newUri.fsPath);
    if (exists) {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      } else {
        await _.rmrf(newUri.fsPath);
      }
    }

    const parentExists = await _.exists(path.dirname(newUri.fsPath));
    if (!parentExists) {
      await _.mkdir(path.dirname(newUri.fsPath));
    }

    return _.rename(oldUri.fsPath, newUri.fsPath);
  }


  refresh(): void {
    // update worksapce root
    this.workspaceRoot = vscode.workspace.getConfiguration().get('easySnippets.workspaceFolder') || '~';
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Snippet): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Snippet): Thenable<Snippet[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No easy snippets folder in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(this.getSnippetsInDirectory(element.fsPath));
    } else {
      const snippets: Snippet[] = this.getSnippetsInDirectory(this.workspaceRoot);
      if (!snippets.length) {
        vscode.window.showInformationMessage('There\' no .esnp file in current workspace folder');
      }
      return Promise.resolve(snippets);
    }
  }

  syncItem(snippet: Snippet): void {
    try {
      this.syncItemHelper(snippet.fsPath);
      vscode.window.showInformationMessage(`Successfully sync ${snippet.label} to ${DEFAULT_FILE_NAME}`);
    } catch (error) {
      console.error(error);
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
    }
  }

  syncAll(): void {
    try {
      this.syncAllHelper();
      vscode.window.showInformationMessage('Sync successfully');
    } catch (error) {
      console.error(error);
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
    }
  }

  private parseEasySnippets(p: string): EasySnippetsParser | void {
    try {
      const source: string = fs.readFileSync(p, 'utf-8');
      const regx: RegExp = /---\s[^-]+\s---/;
      const matched: any[] | null = regx.exec(source);
      if (!matched) {
        return;
      }
      const header: string = matched[0].split(SEPARATOR)[1];
      const body: string = source.replace(matched[0], '');
      const meta: any = yaml.load(header);
      const fname = path.parse(p).name; // file name without extension
      const parser = new EasySnippetsParser(
        meta.prefix ?? fname,
        body,
        p,
        meta.description,
        meta.scope,
        meta.title,
      );
      return parser;
    } catch (error) {
      console.error(error);
      vscode.window.showErrorMessage('Parse .esnp file error', error);
    }
  }

  private syncItemHelper(p: string): void {
    //  if not a .esnp file, return directly
    if (!this.isEasySnippet(p)) {
      return;
    }
    const parser = this.parseEasySnippets(p);
    // if parse failed, return directly
    if (!parser) {
      return;
    }
    const snippetObj = parser.generate();
    const fpath: string = `${getCodeSnippetsDir()}/${DEFAULT_FILE_NAME}`;

    if (pathExists(fpath)) {
      const source: string = fs.readFileSync(fpath, 'utf-8');
      try {
        const originObj: any = JSON.parse(source || "{}");
        originObj[parser.title || parser.prefix] = snippetObj;
        const str = EasySnippetsParser.toString(originObj);
        fs.writeFileSync(fpath, str, 'utf-8');
      } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Parse json error: ${error.message}`);
      }
    } else {
      const result: any = {};
      result[parser.title || parser.prefix] = snippetObj;
      const str = EasySnippetsParser.toString(result);
      fs.writeFileSync(fpath, str, 'utf-8');
    }
  }

  private syncAllHelper(): void {
    const getSnippetsHelper = (p: string) => {
      // console.log(`read ${p}`);
      if (!pathExists(p)) {
        return;
      }
      if (!isDirectory(p)) {
        return this.syncItemHelper(p);
      }
      const resources: string[] = fs.readdirSync(p);
      for (let i: number = 0; i < resources.length; i++) {
        const res: string = resources[i];
        getSnippetsHelper(path.join(p, res));
      }
    };
    getSnippetsHelper(this.workspaceRoot);
  }

  openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }

  private isEasySnippet(p: string): boolean {
    return path.extname(p).toLocaleLowerCase() === '.esnp';
  }

  private getSnippetsInDirectory(snippetsPath: string): Snippet[] {
    if (!pathExists(snippetsPath)) {
      return [];
    }

    const children: string[] = fs.readdirSync(snippetsPath);

    const result: Snippet[] = [];

    const hasSnippetsInDir = (dir: string): boolean => {
      const resources: string[] = fs.readdirSync(dir);
      for (let i: number = 0; i < resources.length; i += 1) {
        const res: string = resources[i];
        const p: string = path.join(this.workspaceRoot, dir, res);
        if (!isDirectory(p)) {
          if (this.isEasySnippet(p)) {
            return true;
          }
          continue;
        } else {
          return hasSnippetsInDir(p);
        }
      }
      return false;
    };

    for (let i: number = 0; i < children.length; i += 1) {
      const fname: string = children[i];
      const fpath: string = path.join(snippetsPath, fname);
      const isDir: boolean = isDirectory(fpath);
      if (this.isEasySnippet(fname)) {
        const uri: vscode.Uri = vscode.Uri.file(fpath);
        const parser: any = this.parseEasySnippets(fpath);
        const snippetObj: ISnippetItem = parser?.generate() || null;
        const description: string = snippetObj?.description ?? '';
        const snp: Snippet = new Snippet(fname, fpath, isDir, description, {
          command: 'easySnippets.openFile',
          title: 'Open file',
          arguments: [uri]
        });
        result.push(snp);
      }
      if (isDir && hasSnippetsInDir(fpath)) {
        const snp: Snippet = new Snippet(fname, fpath, isDir);
        result.push(snp);
      }
    }

    return result;
  }

  async setWorkspaceFolder(): Promise<void> {
    const uri: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select workspace folder',
      canSelectFiles: false,
      canSelectFolders: true
    });
  
    if (!uri?.length) {
      return;
    }
  
    const dirPath: string = uri[0].fsPath;
    await vscode.workspace.getConfiguration().update('easySnippets.workspaceFolder', dirPath, true);
  }
}

export class Snippet extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly fsPath: string,
    public readonly isDir: boolean,
    public readonly description?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${this.label}`;
    this.description = this.description;
  }

  // iconPath = {
  // 	light: path.join(__filename, '..', '..', 'resources', 'light', 'code.svg'),
  // 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'code.svg')
  // };
  // iconPath = new vscode.ThemeIcon('esnp');

  contextValue = this.isDir ? 'folder' : 'snippet';
}
