'use strict';
const {test,before,after,beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails} = require('@firebase/rules-unit-testing');
const {Timestamp} = require('firebase/firestore');
require('firebase/compat/firestore');
let env;
before(async()=>{
  if(!/^(localhost|127\.0\.0\.1):8088$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')) throw Error('Solo emulador local :8088; producción prohibida.');
  env=await initializeTestEnvironment({projectId:'demo-racional-security-tests',firestore:{rules:fs.readFileSync(path.join(__dirname,'..','firestore.rules'),'utf8')}});
});
beforeEach(async()=>env.clearFirestore());
after(async()=>{if(env)await env.cleanup();});
const owner=(uid='user-a',claims={})=>env.authenticatedContext(uid,{email_verified:true,trackerAccess:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
const meta=uid=>'users/'+uid+'/portfolios/main';
const movement=(overrides={})=>({tipo:'aporte',monto:100,desc:'Sintético',fecha:Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),hora:'12:00',clp:0,tc:0,etf:'',acciones:0,orden:0,...overrides});
async function commit(db,uid,data,id='record-0001',remove=false) {
  const parent=db.doc(meta(uid)); const snapshot=await parent.get();
  const revision=snapshot.exists?snapshot.data().revision:0;
  const batch=db.batch();
  batch.set(parent,{schemaVersion:2,revision:revision+1});
  if(remove)batch.delete(db.doc(meta(uid)+'/movements/'+id));
  else batch.set(db.doc(meta(uid)+'/movements/'+id),data);
  return batch.commit();
}
test('propietario Google verificado puede crear, consultar, actualizar y eliminar su movimiento',async()=>{
  const db=owner();
  await assertSucceeds(commit(db,'user-a',movement()));
  await assertSucceeds(db.collection(meta('user-a')+'/movements').limit(10001).get());
  await assertSucceeds(commit(db,'user-a',movement({monto:120})));
  await assertSucceeds(commit(db,'user-a',null,'record-0001',true));
});
test('anónimo no puede leer documentos, consultar colecciones ni crear metadatos',async()=>{
  const db=env.unauthenticatedContext().firestore();
  await assertFails(db.doc(meta('user-a')).get());
  await assertFails(db.collection(meta('user-a')+'/movements').get());
  await assertFails(db.doc(meta('user-a')).set({schemaVersion:2,revision:1}));
});
test('otra cuenta no puede obtener, consultar, crear, actualizar ni borrar datos ajenos',async()=>{
  const good=owner();await commit(good,'user-a',movement());
  const db=owner('user-b'),ref=db.doc(meta('user-a')+'/movements/record-0001');
  await assertFails(ref.get());
  await assertFails(db.collection(meta('user-a')+'/movements').get());
  await assertFails(ref.set(movement()));
  await assertFails(ref.update({monto:900}));
  await assertFails(ref.delete());
  await assertFails(db.doc(meta('user-a')).update({revision:2}));
});
test('cuentas no verificadas y proveedores distintos de Google quedan denegados',async()=>{
  for(const db of [owner('user-a',{email_verified:false}),owner('user-a',{trackerAccess:false}),owner('user-a',{trackerAccess:'true'}),owner('user-a',{firebase:{sign_in_provider:'anonymous'}}),owner('user-a',{firebase:{sign_in_provider:'password'}}),env.authenticatedContext('user-a').firestore()]) {
    await assertFails(db.doc(meta('user-a')).get());
    await assertFails(db.doc(meta('user-a')).set({schemaVersion:2,revision:1}));
  }
});
test('cada cuenta consulta únicamente sus propios movimientos',async()=>{
  await commit(owner('user-a'),'user-a',movement({monto:11}));
  await commit(owner('user-b'),'user-b',movement({monto:22}));
  const result=await assertSucceeds(owner('user-b').collection(meta('user-b')+'/movements').get());
  assert.equal(result.docs.length,1);assert.equal(result.docs[0].data().monto,22);
});
test('sin incrementar revisión no se puede crear, actualizar ni eliminar un movimiento',async()=>{
  const db=owner(),ref=db.doc(meta('user-a')+'/movements/record-0001');
  await assertFails(ref.set(movement()));
  await commit(db,'user-a',movement());
  await assertFails(ref.update({monto:200}));
  await assertFails(ref.delete());
});
test('metadatos solo aceptan revisión inicial 1 e incrementos exactos de 1',async()=>{
  const ref=owner().doc(meta('user-a'));
  await assertFails(ref.set({schemaVersion:2,revision:0}));
  await assertFails(ref.set({schemaVersion:2,revision:2}));
  await assertSucceeds(ref.set({schemaVersion:2,revision:1}));
  for(const revision of [1,0,3,-1,1.5,'2',NaN,Infinity]) await assertFails(ref.set({schemaVersion:2,revision}));
  await assertSucceeds(ref.set({schemaVersion:2,revision:2}));
});
test('no permite borrar metadatos ni añadir roles/UID/permisos',async()=>{
  const ref=owner().doc(meta('user-a'));
  await assertSucceeds(ref.set({schemaVersion:2,revision:1}));
  await assertFails(ref.delete());
  for(const extra of [{role:'admin'},{ownerId:'user-b'},{editors:['user-b']},{records:[]}])
    await assertFails(ref.set({schemaVersion:2,revision:2,...extra}));
});
test('valida campos requeridos y rechaza campos adicionales en create y update',async()=>{
  const db=owner();await commit(db,'user-a',movement());
  const invalid=[{},movement({role:'admin'}),movement({ownerId:'user-b'}),movement({records:[]})];
  for(const key of Object.keys(movement())) {const data=movement();delete data[key];invalid.push(data);}
  for(const data of invalid) {
    await assertFails(commit(db,'user-a',data,'invalid-0001'));
    await assertFails(commit(db,'user-a',data));
  }
  assert.equal((await db.doc(meta('user-a')).get()).data().revision,1);
});
test('create y update rechazan montos, tipos, textos y unidades inválidos',async()=>{
  const db=owner();await commit(db,'user-a',movement());
  const values=[
    {monto:'100'},{monto:NaN},{monto:Infinity},{monto:1e12+1},{monto:-1},{monto:0},
    {tipo:'admin'},{desc:''},{desc:'x'.repeat(501)},{desc:{}},{fecha:'31/02/2026'},
    {fecha:Timestamp.fromDate(new Date('1800-01-01T00:00:00Z'))},
    {fecha:Timestamp.fromDate(new Date('2201-01-01T00:00:00Z'))},
    {fecha:Timestamp.fromDate(new Date('2026-01-01T12:00:00Z'))},{hora:'24:00'},{hora:'12:60'},{hora:'<img>'},{etf:'X'.repeat(31)},
    {clp:-1},{tc:Infinity},{acciones:-0.1},{orden:1.5},{orden:-1}
  ];
  for(const value of values) {
    await assertFails(commit(db,'user-a',movement(value),'invalid-0001'));
    await assertFails(commit(db,'user-a',movement(value)));
  }
});
test('rendimiento negativo y límites válidos se conservan',async()=>{
  const db=owner();
  await assertSucceeds(commit(db,'user-a',movement({tipo:'rendimiento',monto:-100})));
  await assertSucceeds(commit(db,'user-a',movement({monto:1e12,desc:'x'.repeat(500),etf:'X'.repeat(30),hora:'23:59',acciones:1e12})));
});
test('eliminar un campo requerido usando update también se rechaza',async()=>{
  const db=owner();await commit(db,'user-a',movement());
  const batch=db.batch();
  batch.update(db.doc(meta('user-a')),{revision:2});
  // API compat de la instancia que entrega rules-unit-testing.
  batch.update(db.doc(meta('user-a')+'/movements/record-0001'),{monto:(require('firebase/compat/app').default || require('firebase/compat/app')).firestore.FieldValue.delete()});
  await assertFails(batch.commit());
});
test('operación atómica inválida no avanza la revisión ni modifica movimientos',async()=>{
  const db=owner();await commit(db,'user-a',movement());
  const batch=db.batch();batch.update(db.doc(meta('user-a')),{revision:2});
  batch.set(db.doc(meta('user-a')+'/movements/record-0001'),movement({monto:200}));
  batch.set(db.doc(meta('user-a')+'/movements/invalid-0001'),movement({monto:'bad'}));
  await assertFails(batch.commit());
  assert.equal((await db.doc(meta('user-a')).get()).data().revision,1);
  assert.equal((await db.doc(meta('user-a')+'/movements/record-0001').get()).data().monto,100);
});
test('deniega documento heredado, portafolios alternativos, subcolecciones y rutas desconocidas',async()=>{
  const db=owner();
  for(const path of ['libro/ficticio','users/user-a','users/user-a/portfolios/other','users/user-a/portfolios/other/movements/record-0001','users/user-a/portfolios/main/movements/record-0001/private/doc','unknown/doc']) {
    await assertFails(db.doc(path).get());await assertFails(db.doc(path).set(movement()));
  }
  await assertFails(db.collectionGroup('movements').get());
});
test('identificador inválido no puede crearse incluso en lote autorizado',async()=>{
  const db=owner();
  for(const id of ['short','contains.dot','x'.repeat(65)])await assertFails(commit(db,'user-a',movement(),id));
});
test('400 movimientos y revisión caben en una operación autorizada',async()=>{
  const db=owner(),batch=db.batch();
  batch.set(db.doc(meta('user-a')),{schemaVersion:2,revision:1});
  for(let i=0;i<400;i++)batch.set(db.doc(meta('user-a')+'/movements/batch-'+String(i).padStart(5,'0')),movement({orden:i}));
  await assertSucceeds(batch.commit());
});
const {AccountStore}=require('../account-store.js');
const {loadApp,fixture,user}=require('./helpers.cjs');
async function realStore(uid) {
  const validator=(await loadApp()).run('validarMovimiento');
  const storage=new Map();let store,readyResolve,readyReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const timeout=setTimeout(()=>readyReject(Error('No cargó el cliente en emulador')),15000);
  let index=0;
  store=new AccountStore({
    db:owner(uid),storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    uuid:()=>uid+'-record-'+String(++index).padStart(4,'0'),
    timestamp:date=>Timestamp.fromDate(date),validate:validator,projectId:'demo-racional-security-tests',
    onState:state=>{if(state.ready)readyResolve();else if(state.error)readyReject(Error(state.message));}
  });
  store.setUser(user(uid));
  try {await ready;} finally {clearTimeout(timeout);}
  return {store,storage};
}
test('cliente real usa transacciones compatibles con las reglas para crear, editar y borrar',async()=>{
  const {store}=await realStore('client-owner');
  try {
    assert.equal(await store.save([fixture()]),true);
    assert.equal(store.records.length,1);
    const id=store.records[0].id;
    assert.equal(await store.save([{...store.records[0],monto:150}]),true);
    assert.equal(store.records[0].id,id);
    assert.equal(await store.save([]),true);
    assert.equal((await owner('client-owner').collection(meta('client-owner')+'/movements').get()).size,0);
    assert.equal((await owner('client-owner').doc(meta('client-owner')).get()).data().revision,3);
  } finally {store.setUser(null);}
});
test('dos clientes reales con base desactualizada no sobrescriben cambios y conservan borrador',async()=>{
  const first=await realStore('same-owner'),second=await realStore('same-owner');
  second.store.unsubscribe();second.store.unsubscribe=null;
  try {
    assert.equal(await first.store.save([fixture({monto:111})]),true);
    assert.equal(await second.store.save([fixture({monto:222})]),false);
    assert.equal(second.store.records[0].monto,222);
    assert.equal(second.store.dirty,true);
    const result=await owner('same-owner').collection(meta('same-owner')+'/movements').get();
    assert.equal(result.size,1);assert.equal(result.docs[0].data().monto,111);
    assert.equal(JSON.parse(second.storage.get(second.store.key)).records[0].monto,222);
  } finally {first.store.setUser(null);second.store.setUser(null);}
});
test('Google verificado sin custom claim no tiene acceso aunque el UID coincida',async()=>{
  const db=env.authenticatedContext('user-a',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertFails(db.doc(meta('user-a')).get());
  await assertFails(db.doc(meta('user-a')).set({schemaVersion:2,revision:1}));
  await assertFails(db.collection(meta('user-a')+'/movements').get());
});