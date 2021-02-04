// import * as fs from 'fs';
// import * as path from 'path';
const fs = require('fs');

const p = '/Users/jiangjunyu/Projects/private/snippets';

async function readDir(path:string) {
  const data = await fs.readdirSync(p);
  console.log(data);
}

readDir(p);
