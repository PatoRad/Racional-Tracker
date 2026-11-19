/* Prueba de persistencia real con SDK sobre emulador local, NUNCA producción. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const Core=require('../finance-core');
const {createFirestoreRepository}=require('../finance-firestore');
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^(localhost|127\.0\.0\.1):8089$/.test(host||'')||process.env.GCLOUD_PROJECT!=='demo-tracker2')throw Error('La prueba exige demo-tracker2 en localhost:8089');
const user={uid:'integration-owner',emailVerified:true,trackerAccess:true,providerId:'google.com'};
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-tracker2',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(path.join(__dirname,'../firestore.staging.rules'),'utf8')}});await env.clearFirestore()});
after(async()=>env?.cleanup());
function db(){return env.authenticatedContext(user.uid,{email_verified:true,trackerAccess:true,firebase:{sign_in_provider:'google.com'}}).firestore()}
test('revisión, lectura paginada, transferencias y conflicto con SDK real (solo emulador)',async()=>{
 const a=createFirestoreRepository({db:db(),core:Core,user,pageSize:2});
 const b=createFirestoreRepository({db:db(),core:Core,user,pageSize:2});
 assert.equal((await a.read()).revision,0);
 const fixture=Core.demoData();
 const first=await a.commit(fixture,0);assert.equal(first.revision,1);
 const old=await b.read();assert.equal(old.transactions.length,4);
 const extendedAccounts=Core.addAccount(first.accounts,first.transactions,{id:'checking-usd',name:'USD test',type:'checking',currency:'USD',openingBalance:1000});
 const fx=Core.addTransaction(extendedAccounts,first.transactions,{id:'fx-demo',date:'2026-11-19',type:'transfer',amount:9500,toAmount:1000,fromId:'bank-main',toId:'checking-usd',category:'',note:'Cambio',source:'manual'});
 const second=await a.commit({accounts:extendedAccounts,transactions:fx},first.revision);
 assert.equal(second.revision,2);
 assert.equal(Core.calculateBalances(second.accounts,second.transactions)['checking-usd'],2000);
 const stale=Core.addTransaction(old.accounts,old.transactions,{id:'stale-tx',date:'2026-11-19',type:'expense',amount:100,accountId:'bank-main',category:'Otros gastos',note:'Error de conflicto',source:'manual'});
 await assert.rejects(()=>b.commit({accounts:old.accounts,transactions:stale},old.revision),/Conflicto/);
 const again=await b.read();assert.equal(again.transactions.length,5);assert.equal(again.accounts.length,3);
 const deleted=Core.deleteTransaction(again.accounts,again.transactions,'fx-demo');
 const third=await b.commit({accounts:again.accounts,transactions:deleted},again.revision);assert.equal(third.revision,3);
 assert.equal((await a.read()).transactions.length,4);
});
