'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {Timestamp}=require('firebase/firestore');
if(!/^(localhost|127\.0\.0\.1):8089$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')||process.env.GCLOUD_PROJECT!=='demo-tracker2')throw Error('Solo el emulador demo-tracker2 localhost:8089 está autorizado');
let env;
const uid='joint-owner',p='users/'+uid+'/portfolios/main',f='users/'+uid+'/financeV2/state';
const owner=(who=uid,claims={})=>env.authenticatedContext(who,{email_verified:true,trackerAccess:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
const pos={tipo:'aporte',monto:100,desc:'Sintético',fecha:Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),hora:'12:00',clp:0,tc:0,etf:'',acciones:0,orden:0};
const account={name:'Cuenta QA',type:'checking',currency:'CLP',openingBalance:0};
const tx={date:'2026-11-19',type:'income',amount:1000,note:'Test',category:'Sueldo',source:'manual',accountId:'bank-demo'};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-tracker2',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(path.join(__dirname,'../firestore.production-candidate.rules'),'utf8')}})});
after(async()=>{await env?.cleanup()});beforeEach(async()=>{await env.clearFirestore()});
test('las reglas combinadas conservan portafolio y Finanzas como libros independientes',async()=>{
 const db=owner();const a=db.batch();a.set(db.doc(p),{schemaVersion:2,revision:1});a.set(db.doc(p+'/movements/invest-0001'),pos);await assertSucceeds(a.commit());
 const b=db.batch();b.set(db.doc(f),{schemaVersion:1,revision:1});b.set(db.doc(f+'/accounts/bank-demo'),account);b.set(db.doc(f+'/transactions/income-0001'),tx);await assertSucceeds(b.commit());
 assert.equal((await db.doc(p+'/movements/invest-0001').get()).data().monto,100);
 assert.equal((await db.doc(f+'/transactions/income-0001').get()).data().amount,1000);
 const b2=db.batch();b2.update(db.doc(f),{revision:2});b2.update(db.doc(f+'/transactions/income-0001'),{amount:1200});await assertSucceeds(b2.commit());
 assert.equal((await db.doc(p).get()).data().revision,1);
});
test('usuarios ajenos, sin permiso y anónimos no acceden a ninguno de los libros',async()=>{
 for(const db of [owner('stranger'),owner(uid,{trackerAccess:false}),owner(uid,{email_verified:false}),owner(uid,{firebase:{sign_in_provider:'password'}}),env.unauthenticatedContext().firestore()]){
  await assertFails(db.doc(p).get());await assertFails(db.doc(f).get());
  await assertFails(db.doc(p).set({schemaVersion:2,revision:1}));await assertFails(db.doc(f).set({schemaVersion:1,revision:1}));
 }
});
test('bloquea campos ajenos, escrituras sin revisión y rutas heredadas',async()=>{
 const db=owner();await assertFails(db.doc('libro/legacy-data').get());
 const badP=db.batch();badP.set(db.doc(p),{schemaVersion:2,revision:1});badP.set(db.doc(p+'/movements/invest-0001'),{...pos,role:'admin'});await assertFails(badP.commit());
 const badF=db.batch();badF.set(db.doc(f),{schemaVersion:1,revision:1});badF.set(db.doc(f+'/transactions/income-0001'),{...tx,amount:-1});await assertFails(badF.commit());
 await assertFails(db.doc(f+'/transactions/income-0001').set(tx));
 await assertFails(db.doc(p+'/movements/invest-0001').set(pos));
});
test('subcolecciones desconocidas siguen cerradas',async()=>{
 const db=owner();for(const path of ['users/joint-owner/private/secrets','users/joint-owner/financeV2/other','users/joint-owner/financeV2/state/unknown/abc']){
  await assertFails(db.doc(path).get());await assertFails(db.doc(path).set({test:true}));
 }
});