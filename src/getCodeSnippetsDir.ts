import * as os from 'os';
import { CODE_SNIPPETS_DIR } from './constants';

export default function getCodeSnippetsDir(): string {
  const platform = os.platform();
  let rootPath: string | undefined = '';
  switch(platform) {
    case 'darwin':
      rootPath = process.env.HOME;
      return `${rootPath}${CODE_SNIPPETS_DIR.macOS}`;
    case 'linux':
      rootPath = process.env.HOME;
      return `${rootPath}${CODE_SNIPPETS_DIR.linux}`;
    case 'win32':
      rootPath = process.env.APPDATA;
      return `${rootPath}${CODE_SNIPPETS_DIR.windows}`;
    default:
      return '';
  }
}