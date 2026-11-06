'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class FakeTimestamp {
  constructor(date) { this.value = date.getTime(); }
  toDate() { return new Date(this.value); }
}
function copy(value) {
  if (value instanceof FakeTimestamp) return new FakeTimestamp(value.toDate());
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)]));
  return value;
}
const user = uid => ({uid,emailVerified:true,trackerAccess:true,async getIdTokenResult(){return {claims:{trackerAccess:true}};},email:uid+'@example.test',displayName:uid,providerData:[{providerId:'google.com'}]});
function fixture(overrides={}) {
  return {tipo:'aporte',monto:100,desc:'Depósito sintético',fecha:'01/01/2026',hora:'12:00',clp:0,tc:0,etf:'',acciones:0,...overrides};
}
function toData(record,index) {
  const {id,...data} = {hora:'',clp:0,tc:0,etf:'',acciones:0,orden:index,...record};
  const [d,m,y] = data.fecha.split('/').map(Number);
  data.fecha = new FakeTimestamp(new Date(Date.UTC(y,m-1,d)));
  return data;
}
class FakeDB {
  constructor(options={}) { this.data = new Map(); this.listeners=new Map(); this.writes=[]; this.savedStates=[]; this.options=options; }
  snapshot(path,metadata={}) {
    const data = copy(this.data.get(path));
    return {id:path.split('/').at(-1),exists:data!==undefined,data:()=>copy(data),metadata};
  }
  doc(path) {
    const db=this;
    return {path,id:path.split('/').at(-1),
      async get() { return db.snapshot(path); },
      collection(name) { return db.collection(path+'/'+name); },
      onSnapshot(opts,cb,error) { db.listeners.set(path,{cb,error}); queueMicrotask(()=>{if(db.listeners.get(path)?.cb===cb) cb(db.snapshot(path));}); return ()=>db.listeners.delete(path); }
    };
  }
  collection(path) {
    const db=this;
    const query=(n,cursor)=>({startAfter:doc=>query(n,doc),async get() {
      if(db.options.queryDeferred) await db.options.queryDeferred;
      const after=cursor?.id;
      return {docs:[...db.data.keys()].filter(key=>key.startsWith(path+'/')&&key.slice(path.length+1).indexOf('/')<0&&(!after||key.slice(path.length+1)>after)).sort().slice(0,n).map(key=>db.snapshot(key))};
    }});
    return {doc:id=>db.doc(path+'/'+id),limit:n=>query(n,null)};
  }
  seed(uid,list,revision) {
    const meta='users/'+uid+'/portfolios/main';
    for(const key of this.data.keys()) if(key.startsWith(meta+'/movements/')) this.data.delete(key);
    const rev=revision===undefined?(this.data.get(meta)?.revision||0)+1:revision;
    if(rev) this.data.set(meta,{schemaVersion:2,revision:rev}); else this.data.delete(meta);
    list.forEach((record,index)=>this.data.set(meta+'/movements/'+(record.id||'synthetic-'+String(index).padStart(5,'0')),toData(record,index)));
  }
  emit(uid,metadata={}) { const meta='users/'+uid+'/portfolios/main'; this.listeners.get(meta)?.cb(this.snapshot(meta,metadata)); }
  async runTransaction(callback) {
    if(this.options.failWrite) throw Error('offline');
    const ops=[];
    await callback({get:async ref=>this.snapshot(ref.path),set:(ref,data)=>ops.push({path:ref.path,data:copy(data)}),delete:ref=>ops.push({path:ref.path,delete:true})});
    for(const op of ops) { op.delete?this.data.delete(op.path):this.data.set(op.path,copy(op.data)); this.writes.push(op); }
    const meta=ops.find(op=>op.path.endsWith('/portfolios/main'))?.path;
    if(meta) {
      this.savedStates.push([...this.data.keys()].filter(key=>key.startsWith(meta+'/movements/')).length);
      queueMicrotask(()=>this.listeners.get(meta)?.cb(this.snapshot(meta)));
    }
  }
}
const settle=async()=>{for(let i=0;i<3;i++) await new Promise(resolve=>setImmediate(resolve));};
async function loadApp(initialRecords=[],options={}) {
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].at(-1)[1];
  const elements=new Map(), storage=new Map(Object.entries(options.storage||{})), alerts=[], downloads=[], events={};
  const db=new FakeDB(options), uid=options.user===undefined?'user-a':options.user?.uid;
  if(uid) db.seed(uid,initialRecords,initialRecords.length?1:0);
  const getElementById=id=>{
    if(!elements.has(id)) elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},focus(){}});
    return elements.get(id);
  };
  let authCallback,authError; const calls={init:0,popup:0,persistence:[],appcheck:0};
  const auth={
    onAuthStateChanged(cb,error){authCallback=cb;authError=error; cb(options.user===undefined?user('user-a'):options.user);},
    async setPersistence(mode){calls.persistence.push(mode); if(options.persistenceFail) throw Error('persistence');},
    async signInWithPopup(){calls.popup++;if(options.popupFail)throw Error('popup');authCallback(user('user-a'));},
    async signOut(){authCallback(null);}
  };
  function authFactory(){return auth;}
  authFactory.Auth={Persistence:{SESSION:'session'}};
  authFactory.GoogleAuthProvider=class {setCustomParameters(params){calls.provider=params;}};
  function appCheck(){return {activate(){calls.appcheck++;}};}
  appCheck.ReCaptchaEnterpriseProvider=class {};
  function firestore(){return db;}
  firestore.Timestamp={fromDate:date=>new FakeTimestamp(date)};
  let counter=0;
  class Reader { readAsText(file) { this.promise=this.onload({target:{result:file.contents}}); } }
  const context=vm.createContext({
    document:{getElementById,querySelectorAll(){return [];},addEventListener(){},createElement(){const link={click(){downloads.push(link);}};return link;},activeElement:{id:''}},
    firebase:{initializeApp(){calls.init++;},firestore,auth:authFactory,appCheck},
    localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(options.storageFails)throw Error('quota');storage.set(key,value);}},
    crypto:{randomUUID:()=> 'generated-'+String(++counter).padStart(5,'0')},
    window:{RACIONAL_CONFIG:options.config||{appCheckSiteKey:'synthetic-test-key',requireAppCheck:true},addEventListener(name,callback){events[name]=callback;}},
    Chart:class {destroy(){}},FileReader:Reader,
    Blob:class {constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){downloads.push(blob);return 'blob:synthetic';},revokeObjectURL(){}},
    setTimeout(){},alert:msg=>alerts.push(msg),confirm:()=>options.confirm!==false
  });
  vm.runInContext(fs.readFileSync(path.join(root,'account-store.js'),'utf8'),context);
  vm.runInContext(source,context,{filename:'index.html:inline',timeout:1000});
  await settle();
  return {context,db,storage,alerts,downloads,calls,events,
    element:getElementById,run:code=>vm.runInContext(code,context,{timeout:1000}),
    get store(){return vm.runInContext('store',context);},
    mockWrites:db.writes,
    async snapshot(list=initialRecords,metadata={}){db.seed(uid,list);db.emit(uid,metadata);await settle();},
    async changeUser(next){authCallback(next);await settle();},
    async authError(){authError(Error('auth'));await settle();}
  };
}
module.exports={loadApp,fixture,user,FakeDB,FakeTimestamp,settle};
