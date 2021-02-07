import { SEPARATOR } from './constants';

export interface ISnippetItem {
  prefix: string,
  body: string[],
  scope?: string,
  description?: string,
}

export class EasySnippetsParser {
  constructor(
    public prefix: string,
    public body: string,
    public fsPath: string,
    public description?: string,
    public scope?: string,
    public title?: string,
  ) {
    this.body = this.body.trimLeft();
    this.title = this.title ?? this.prefix;
    // vscode.commands.registerCommand('easySnippets.parseAndSync', this.parseAndSync);
  }

  template(): string {
    const result: Array<string> = this.scope ? [
      SEPARATOR,
      `prefix: ${this.prefix}`,
      `scope: ${this.scope}`,
      `description: ${this.description}`,
      `title: ${this.title}`,
      SEPARATOR,
    ] : [
        SEPARATOR,
        `prefix: ${this.prefix}`,
        `description: ${this.description}`,
        `title: ${this.title}`,
        SEPARATOR,
    ];

    return result.join('\n');
  }

  generate(): any {
    const snippetItem: ISnippetItem = {
      scope: this.scope,
      prefix: this.prefix,
      description: this.description,
      body: this.body.split('\n'),
    };

    return snippetItem;
  }

  static toString(obj: any): string {
    return JSON.stringify(obj, null, '  ');
  }
}
