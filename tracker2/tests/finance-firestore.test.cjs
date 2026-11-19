const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../finance-core');
const {authorized,createFirestoreRepository}=require('../finance-firestore');
const user={uid:'uid_demo',emailVerified:true,trackerAccess:true,providerId:'google.com'};
function mockFirestore(){
 const memory=new Map();let abortNext=false;
 const ref=(path)=>({path,id:path.split('/').at(-1),collection(name){return coll(path+'/'+name)},async get(){return snap(path)},});
 const snap=(path)=>({exists:memory.has(path),id:path.split('/').at(-1),data(){return structuredClone(memory.get(path))}});
 const coll=(path)=>({doc(id){return ref(path+'/'+id)},limit(n){return {startAfter(last){return {get:()=>this.get(last)}},async get(last){let docs=[...memory.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).sort();if(last?.path)docs=docs.filter(x=>x>last.path);return {docs:docs.slice(0,n).map(k=>({...snap(k),path:k}))}}}}});
 return {doc:ref,failNext(){abortNext=true},_memory:memory,async runTransaction(action){
  let operations=[],readsFinished=false;
  const trx={async get(ref){if(readsFinished)throw Error('Lectura tras escritura');return snap(ref.path)},set(ref,data){readsFinished=true;operations.push(['set',ref.path,structuredClone(data)])},delete(ref){readsFinished=true;operations.push(['delete',ref.path])}};
  await action(trx);if(abortNext){abortNext=false;throw Error('Error simulado; commit rechazado');}
  for(const [op,path,data] of operations){if(op==='delete')memory.delete(path);else memory.set(path,data);}
 }};
}
test('sin permiso no se crea un adaptador de persistencia',()=>{
 assert.equal(authorized(user),true);assert.equal(authorized({...user,trackerAccess:false}),false);
 assert.throws(()=>createFirestoreRepository({db:mockFirestore(),core:Core,user:{...user,emailVerified:false}}),/sesión/);
});
test('crear y leer libro aislado en Firestore simulado sin datos reales',async()=>{
 const db=mockFirestore(),r=createFirestoreRepository({db,core:Core,user,pageSize:2});const old=await r.read();assert.equal(old.revision,0);
 const initial=Core.demoData(),saved=await r.commit(initial,0);assert.equal(saved.revision,1);
 const reread=await r.read();assert.equal(reread.transactions.length,4);assert.equal(reread.accounts.length,2);
 assert.equal(reread.transactions[0].source,'demo');assert.ok([...db._memory.keys()].every(k=>k.startsWith('users/uid_demo/financeV2/state')));
});
test('conflictos, fallo de nube y reintentos no dejan escritura parcial',async()=>{
 const db=mockFirestore(),r=createFirestoreRepository({db,core:Core,user});await r.read();const first=Core.demoData();await r.commit(first,0);
 const old=await r.read(),newTx=Core.addTransaction(old.accounts,old.transactions,{id:'tx-sim',date:'2026-11-19',type:'expense',amount:25,accountId:'bank-main',category:'Otros gastos',note:'Prueba',source:'manual'});
 db.failNext();await assert.rejects(()=>r.commit({accounts:old.accounts,transactions:newTx},old.revision),/rechazado/);
 assert.equal((await r.read()).transactions.length,4);
 await r.commit({accounts:old.accounts,transactions:newTx},old.revision);
 await assert.rejects(()=>r.commit({accounts:old.accounts,transactions:newTx},old.revision),/Conflicto/);
 assert.equal((await r.read()).transactions.length,5);
});
