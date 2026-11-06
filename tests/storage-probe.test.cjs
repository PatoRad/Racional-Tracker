const {test}=require('node:test');const assert=require('node:assert/strict');
const Probe=require('../storage-probe.js');
const uid='probe-owner',id='qa_11111111-1111-4111-8111-111111111111';
const meta='users/'+uid+'/portfolios/main',record=meta+'/movements/'+id;
const timestamp=date=>({toMillis:()=>date.getTime()});
function fake({failEdit=false}={}){
  const data=new Map([[meta,{schemaVersion:2,revision:7}],[meta+'/movements/real-other',{desc:'untouched'}]]),reads=[];let calls=0;
  function snapshot(p){reads.push(p);return {exists:data.has(p),data:()=>data.get(p)};}
  const db={doc:p=>({path:p,get:async()=>snapshot(p)}),runTransaction:async callback=>{calls++;if(failEdit&&calls===2)throw Error('offline');const writes=[];await callback({get:async ref=>snapshot(ref.path),set:(ref,d)=>writes.push(()=>data.set(ref.path,d)),update:(ref,d)=>writes.push(()=>data.set(ref.path,{...data.get(ref.path),...d})),delete:ref=>writes.push(()=>data.delete(ref.path))});writes.forEach(w=>w());}};
  return {db,data,reads};
}
test('probe CRUD cleans its only record and never reads other movements',async()=>{const f=fake();const r=await Probe.run({...f,uid,id,timestamp});assert.equal(r.success,true);assert.equal(r.cleaned,true);assert.equal(f.data.has(record),false);assert.deepEqual(f.data.get(meta+'/movements/real-other'),{desc:'untouched'});assert.equal(f.data.get(meta).revision,10);assert.ok(f.reads.every(p=>p===meta||p===record));});
test('failed edit still cleans created probe',async()=>{const f=fake({failEdit:true});const r=await Probe.run({...f,uid,id,timestamp});assert.equal(r.success,false);assert.equal(r.cleaned,true);assert.equal(f.data.has(record),false);});
test('collision never overwrites or deletes existing record',async()=>{const f=fake();f.data.set(record,{desc:'existing'});const r=await Probe.run({...f,uid,id,timestamp});assert.equal(r.errorCode,'probe-collision');assert.deepEqual(f.data.get(record),{desc:'existing'});assert.equal(f.data.get(meta).revision,7);});
test('cleanup refuses changed record and unexpected IDs',async()=>{const f=fake();f.data.set(record,{desc:'changed'});await assert.rejects(()=>Probe.cleanup({...f,uid,id,timestamp}));assert.deepEqual(f.data.get(record),{desc:'changed'});await assert.rejects(()=>Probe.cleanup({...f,uid,id:'real-other',timestamp}));});
test('unexpected metadata stops writes while confirming missing probe is clean',async()=>{const f=fake();f.data.set(meta,{schemaVersion:1,revision:7});const r=await Probe.run({...f,uid,id,timestamp});assert.equal(r.success,false);assert.equal(r.cleaned,true);assert.deepEqual(f.data.get(meta),{schemaVersion:1,revision:7});});
