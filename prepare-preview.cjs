'use strict';
// Prepare files only. This script never contacts Firebase or deploys anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const dir = path.join(root, '.tools', 'preview');
const publicDir = path.join(dir, 'public');
const files = ['index.html', 'account-store.js', 'app-config.js', 'verificar-acceso.html', 'access-check.js'];
fs.mkdirSync(publicDir, {recursive: true});
for (const existing of fs.readdirSync(publicDir)) {
  if (!files.includes(existing) || !fs.lstatSync(path.join(publicDir, existing)).isFile()) {
    throw Error('Unexpected preview content; inspect it before preparing a deployment');
  }
}
const manifest = files.map(name => {
  const content = fs.readFileSync(path.join(root, name));
  const dest = path.join(publicDir, name);
  if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) throw Error('Symlink refused');
  fs.writeFileSync(dest, content);
  return {name, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex')};
});
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({hosting:{
  public:'public', site:'contabilidad-4f074',
  ignore:['firebase.json','**/.*','**/node_modules/**'],
  headers:[{source:'**',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'}]}]
}}, null, 2) + '\n');
console.log(JSON.stringify({prepared:true, deployed:false, directory:dir, files:manifest}, null, 2));
