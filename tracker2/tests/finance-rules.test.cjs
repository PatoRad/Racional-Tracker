/* SOLO se ejecuta en emulador local 127.0.0.1:8089 con --project demo-tracker2. */
const test=require('node:test'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fs=require('node:fs'),path=require('node:path');
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host||!/^(127\.0\.0\.1|localhost):8089$/.test(host)||process.env.GCLOUD_PROJECT!=='demo-tracker2')throw Error('Solo emulador demo-tracker2 en localhost:8089');
let env;
const uid='test-user';const base=`users/${uid}/financeV2/state`;
const sampleAccount={name:'Banco ensayo',type:'checking',currency:'CLP',openingBalance:0};
const sampleTx={date:'2026-11-19',type:'income',amount:1000,note:'Sintético',category:'Sueldo',source:'manual',accountId:'bank-demo'};
const auth=(id=uid,claims={})=>env.authenticatedContext(id,{email_verified:true,trackerAccess:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
test.before(async()=>{env=await initializeTestEnvironment({projectId:'demo-tracker2',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(path.resolve(__dirname,'../firestore.staging.rules'),'utf8')}})});
test.after(async()=>{await env?.cleanup()});
test.beforeEach(async()=>{await env.clearFirestore()});
test('solo dueño habilitado puede crear meta, cuentas y movimientos en una transacción',async()=>{
 const db=auth(),batch=db.batch();batch.set(db.doc(base),{schemaVersion:1,revision:1});batch.set(db.doc(base+'/accounts/bank-demo'),sampleAccount);batch.set(db.doc(base+'/transactions/demo-income'),sampleTx);await assertSucceeds(batch.commit());
 const other=auth('another-user');await assertFails(other.doc(base+'/transactions/demo-income').get());
 await assertFails(env.unauthenticatedContext().firestore().doc(base).get());
 await assertFails(auth(uid,{trackerAccess:false}).doc(base).get());
 await assertFails(auth(uid,{email_verified:false}).doc(base).get());
});
test('regla deniega movimientos sin avance de revisión, campos extra y montos inválidos',async()=>{
 const db=auth();await assertSucceeds(db.doc(base).set({schemaVersion:1,revision:1}));
 await assertFails(db.doc(base+'/transactions/demo-income').set(sampleTx));
 const invalid=db.batch();invalid.set(db.doc(base),{schemaVersion:1,revision:2});invalid.set(db.doc(base+'/transactions/demo-income'),{...sampleTx,amount:-100});await assertFails(invalid.commit());
 const malformed=db.batch();malformed.set(db.doc(base),{schemaVersion:1,revision:2});malformed.set(db.doc(base+'/accounts/bank-demo'),{...sampleAccount,admin:true});await assertFails(malformed.commit());
 const valid=db.batch();valid.set(db.doc(base),{schemaVersion:1,revision:2});valid.set(db.doc(base+'/transactions/demo-income'),sampleTx);await assertSucceeds(valid.commit());
 await assertFails(db.doc(base+'/accounts/bank-demo').delete());
});
test('rutas de portafolio legado y escritura ajena se mantienen denegadas en ruleset de ensayo',async()=>{
 const db=auth();await assertFails(db.doc('users/test-user/portfolios/main').get());await assertFails(db.doc('users/other/financeV2/state').set({schemaVersion:1,revision:1}));
});
