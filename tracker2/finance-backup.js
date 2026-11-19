/* Respaldos portables versionados. No transmiten datos ni autorizan escrituras en producción. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceBackup=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_BYTES=2_000_000;
const clone=o=>JSON.parse(JSON.stringify(o));
function assert(condition,message){if(!condition)throw Error(message);}
function ownerValid(owner){return typeof owner==='string'&&/^[A-Za-z0-9_-]{3,128}$/.test(owner);}
function canonical(data){return JSON.stringify(data);}
async function digest(str){assert(globalThis.crypto?.subtle&&typeof TextEncoder!=='undefined','Se requiere WebCrypto para comprobar el respaldo');const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');}
async function exportBackup(core,ledger,owner='demo-only'){
 assert(ownerValid(owner),'Propietario inválido');core.validateLedger(ledger.accounts,ledger.transactions);
 const data={version:1,app:'racional-tracker-finance',owner,accounts:clone(ledger.accounts),transactions:clone(ledger.transactions)};
 const result={...data,checksum:await digest(canonical(data))};
 const json=JSON.stringify(result,null,2);
 assert(new TextEncoder().encode(json).byteLength<=MAX_BYTES,'Respaldo demasiado grande');
 return json;
}
async function importBackup(core,input,owner='demo-only'){
 assert(ownerValid(owner),'Propietario inválido');
 assert(typeof input==='string'&&new TextEncoder().encode(input).byteLength<=MAX_BYTES,'Archivo inválido o demasiado grande');
 const json=JSON.parse(input);
 assert(json&&typeof json==='object'&&!Array.isArray(json),'Respaldo inválido');
 assert(Object.keys(json).sort().join(',')==='accounts,app,checksum,owner,transactions,version','Estructura de respaldo inválida');
 assert(json.app==='racional-tracker-finance'&&json.version===1,'Formato de respaldo incompatible');
 assert(json.owner===owner,'Respaldo de otra cuenta: importación bloqueada');
 assert(typeof json.checksum==='string'&&/^[0-9a-f]{64}$/.test(json.checksum),'Firma de integridad inválida');
 const payload={version:json.version,app:json.app,owner:json.owner,accounts:json.accounts,transactions:json.transactions};
 assert((await digest(canonical(payload)))===json.checksum,'El respaldo está alterado o dañado');
 core.validateLedger(json.accounts,json.transactions);
 return clone({accounts:json.accounts,transactions:json.transactions});
}
return Object.freeze({MAX_BYTES,exportBackup,importBackup});
});
