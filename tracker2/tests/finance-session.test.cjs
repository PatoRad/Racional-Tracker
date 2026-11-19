'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require.resolve('../finance-session.js');
function setup({readReject=false,readPending=null}={}){
 delete require.cache[path];let listener=null,activated=0,reads=0;
 const user={uid:'qa-owner',emailVerified:true,getIdTokenResult:async()=>({claims:{trackerAccess:true,firebase:{sign_in_provider:'google.com'}}})};
 const auth={setPersistence:async()=>{},onAuthStateChanged(cb){listener=cb;return()=>{};},signInWithPopup:async()=>user,signOut:async()=>{await listener(null)}};
 function Auth(){return auth;}Auth.Auth={Persistence:{SESSION:'session'}};Auth.GoogleAuthProvider=class {setCustomParameters(){}};
 function Check(){return{activate(){activated++}};}Check.ReCaptchaEnterpriseProvider=class{};
 const app=[];global.firebase={apps:app,initializeApp(options){app.push({options})},app(){return app[0]},appCheck:Check,auth:Auth,firestore:()=>({doc(){}})};
 global.RACIONAL_CONFIG={requireAppCheck:true,appCheckSiteKey:'test-only'};
 global.FinanceCore={validateLedger(){}};
 global.FinanceFirestore={createFirestoreRepository(){return{read:async()=>{reads++;if(readPending)return readPending;if(readReject)throw Object.assign(Error('secret-message'),{code:'permission-denied'});return{revision:0,accounts:[],transactions:[]};}}}};
 const api=require(path),events=[];
 const cb={onSignedOut:m=>events.push(['out',m]),onLoading:()=>events.push(['loading']),onForbidden:m=>events.push(['forbidden',m]),onReady:(_repo,d,u)=>events.push(['ready',d.revision,u.uid]),onError:m=>events.push(['error',m])};
 return{api,user,events,cb,trigger:u=>listener(u),count:()=>({reads,activated})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('sin autorización o anónimo no se leen datos de Firestore',async()=>{
 const a=setup();await a.api.start(a.cb);await a.trigger(null);
 await a.trigger({...a.user,getIdTokenResult:async()=>({claims:{trackerAccess:false,firebase:{sign_in_provider:'google.com'}}})});await flush();
 assert.equal(a.count().reads,0);assert.equal(a.events.at(-1)[0],'forbidden');
});
test('cuenta Google verificada y autorizada puede cargar y cerrar sesión',async()=>{
 const a=setup();await a.api.start(a.cb);await a.trigger(a.user);await flush();
 assert.equal(a.events.at(-1)[0],'ready');assert.equal(a.count().reads,1);
 await a.api.signOut();assert.equal(a.events.at(-1)[0],'out');
});
test('respuestas de token tardías tras cierre no muestran información',async()=>{
 const a=setup();let finish;const later=new Promise(resolve=>finish=resolve);await a.api.start(a.cb);
 const pending=a.trigger({...a.user,getIdTokenResult:()=>later});await a.trigger(null);
 finish({claims:{trackerAccess:true,firebase:{sign_in_provider:'google.com'}}});await pending;await flush();
 assert.equal(a.events.at(-1)[0],'out');assert.equal(a.count().reads,0);
});
test('lectura tardía de Firestore tras cierre no muestra información',async()=>{
 let finish;const later=new Promise(resolve=>finish=resolve);const a=setup({readPending:later});await a.api.start(a.cb);
 const pending=a.trigger(a.user);await flush();await a.trigger(null);
 finish({revision:0,accounts:[],transactions:[]});await pending;await flush();
 assert.equal(a.events.at(-1)[0],'out');assert.equal(a.events.filter(v=>v[0]==='ready').length,0);
});
test('no filtra errores internos de Firestore',async()=>{
 const a=setup({readReject:true});await a.api.start(a.cb);await a.trigger(a.user);await flush();
 assert.equal(a.events.at(-1)[0],'error');assert.ok(!a.events.at(-1)[1].includes('secret-message'));
});
test('sin App Check se bloquea el arranque',async()=>{
 const a=setup();global.RACIONAL_CONFIG={requireAppCheck:false,appCheckSiteKey:''};
 await assert.rejects(a.api.start(a.cb),/App Check/);assert.equal(a.count().activated,0);
});