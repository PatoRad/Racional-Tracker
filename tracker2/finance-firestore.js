/* Adaptador aislado para Firestore compat: NO inicializa Firebase ni selecciona un proyecto.
   El servidor debe aplicar las reglas de tracker2/firestore.staging.rules antes de su uso.
   No conectar al proyecto de producción durante el desarrollo. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceFirestore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=o=>JSON.parse(JSON.stringify(o));
const idOK=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{3,80}$/.test(s);
function authorized(user){return Boolean(user&&/^[A-Za-z0-9_-]{1,128}$/.test(user.uid||'')&&user.emailVerified===true&&user.trackerAccess===true&&user.providerId==='google.com');}
function same(a,b){return JSON.stringify(a,Object.keys(a).sort())===JSON.stringify(b,Object.keys(b).sort());}
function diff(old,newer){const prev=new Map(old.map(d=>[d.id,d])),next=new Map(newer.map(d=>[d.id,d]));return {set:newer.filter(d=>!prev.has(d.id)||!same(d,prev.get(d.id))),remove:old.filter(d=>!next.has(d.id))};}
function createFirestoreRepository({db,core,user,maxWrites=250,pageSize=250}){
 if(!authorized(user)||!db||typeof db.doc!=='function'||!core?.validateLedger)throw Error('No existe una sesión habilitada para finanzas');
 if(!Number.isInteger(maxWrites)||maxWrites<1||maxWrites>400)throw Error('Límite de escrituras inválido');
 const path=`users/${user.uid}/financeV2/state`,meta=db.doc(path);
 const accounts=meta.collection('accounts'),transactions=meta.collection('transactions');
 let last=null;
 async function pages(coll){let items=[],cursor=null;while(true){let query=coll.limit(pageSize);if(cursor)query=query.startAfter(cursor);const snap=await query.get({source:'server'});items.push(...snap.docs.map(d=>({...d.data(),id:d.id})));if(items.length>20000)throw Error('Demasiados registros: no se cargó un libro incompleto');if(snap.docs.length<pageSize)break;cursor=snap.docs.at(-1);}return items;}
 function revision(snapshot){if(!snapshot.exists)return 0;const d=snapshot.data();if(!d||d.schemaVersion!==1||!Number.isSafeInteger(d.revision)||d.revision<1)throw Error('Revisión financiera inválida');return d.revision;}
 async function read(){for(let tries=0;tries<3;tries++){
  const head=await meta.get({source:'server'}),rev=revision(head);
  const [ac,tx]=await Promise.all([pages(accounts),pages(transactions)]);
  if(!rev&&(ac.length||tx.length))throw Error('Colección financiera sin metadatos');
  const tail=revision(await meta.get({source:'server'}));if(tail!==rev)continue;
  core.validateLedger(ac,tx);last={revision:rev,accounts:clone(ac),transactions:clone(tx)};return clone(last);
 }throw Error('Conflicto durante la lectura: vuelve a cargar');}
 async function commit(next,expectedRevision){
  if(!last||!Number.isSafeInteger(expectedRevision)||expectedRevision!==last.revision)throw Error('Conflicto local: vuelve a cargar');
  core.validateLedger(next.accounts,next.transactions);
  const a=diff(last.accounts,next.accounts),t=diff(last.transactions,next.transactions);
  const count=a.set.length+a.remove.length+t.set.length+t.remove.length;
  if(a.remove.length)throw Error('No se permite eliminar cuentas: hay que diseñar primero el archivado');
  if(count>maxWrites)throw Error('Hay demasiados cambios para una operación atómica');
  if(!count)return clone(last);
  await db.runTransaction(async tx=>{
   const head=await tx.get(meta);if(revision(head)!==expectedRevision)throw Error('Conflicto remoto: vuelve a cargar');
   const ops=[...a.set.map(x=>[accounts.doc(x.id),x,false,'account']),...t.set.map(x=>[transactions.doc(x.id),x,false,'transaction']),...t.remove.map(x=>[transactions.doc(x.id),x,true,'transaction'])];
   for(const [ref,row,_del,kind] of ops){const doc=await tx.get(ref);const prior=(kind==='account'?last.accounts:last.transactions).find(x=>x.id===row.id);if(prior ? (!doc.exists||!same({id:doc.id,...doc.data()},prior)):doc.exists)throw Error('Conflicto de movimiento: vuelve a cargar');}
   // Firestore exige que todas las lecturas de transacción precedan a las escrituras.
   tx.set(meta,{schemaVersion:1,revision:expectedRevision+1});
   for(const [ref,row,del] of ops){if(del)tx.delete(ref);else{const {id,...data}=row;tx.set(ref,data);}}
  });
  last={revision:expectedRevision+1,accounts:clone(next.accounts),transactions:clone(next.transactions)};
  return clone(last);
 }
 return Object.freeze({read,commit,path});
}
return Object.freeze({authorized,createFirestoreRepository});
});
