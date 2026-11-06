(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StorageProbe=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const idPattern=/^qa_[a-f0-9-]{36}$/;
  const fields=['tipo','monto','desc','fecha','hora','clp','tc','etf','acciones','orden'];
  function context(db,uid,id){
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!idPattern.test(id))throw Error('invalid-probe-identity');
    const meta=db.doc('users/'+uid+'/portfolios/main');
    return {meta,ref:db.doc(meta.path+'/movements/'+id)};
  }
  function payload(id,timestamp,monto=1){return {tipo:'aporte',monto,desc:'PRUEBA TEMPORAL RACIONAL '+id,fecha:timestamp(new Date('2026-01-01T00:00:00Z')),hora:'00:00',clp:0,tc:0,etf:'',acciones:0,orden:0};}
  function matches(data,id,timestamp){
    if(!data||Object.keys(data).length!==fields.length)return false;
    const expected=payload(id,timestamp,data.monto);
    return (data.monto===1||data.monto===2)&&fields.every(key=>key==='fecha'?data.fecha?.toMillis?.()===expected.fecha.toMillis():data[key]===expected[key]);
  }
  function advance(tx,meta,snapshot){
    if(snapshot.exists){const d=snapshot.data();if(Object.keys(d).length!==2||d.schemaVersion!==2||!Number.isSafeInteger(d.revision)||d.revision<1||d.revision>=Number.MAX_SAFE_INTEGER)throw Error('unexpected-meta');tx.update(meta,{revision:d.revision+1});}
    else tx.set(meta,{schemaVersion:2,revision:1});
  }
  async function cleanup({db,uid,id,timestamp}){
    const {meta,ref}=context(db,uid,id);
    await db.runTransaction(async tx=>{
      const m=await tx.get(meta),s=await tx.get(ref);
      if(!s.exists)return;
      if(!matches(s.data(),id,timestamp))throw Error('probe-content-changed');
      advance(tx,meta,m);tx.delete(ref);
    });
    if((await ref.get({source:'server'})).exists)throw Error('cleanup-not-confirmed');
  }
  async function run({db,uid,id,timestamp,onStep=()=>{}}){
    const {meta,ref}=context(db,uid,id);
    let collision=false,success=false,errorCode=null;
    try{
      onStep('Creando el registro ficticio…');
      await db.runTransaction(async tx=>{const m=await tx.get(meta),s=await tx.get(ref);if(s.exists){collision=true;throw Error('probe-collision');}advance(tx,meta,m);tx.set(ref,payload(id,timestamp));});
      const first=await ref.get({source:'server'});
      if(!first.exists||!matches(first.data(),id,timestamp)||first.data().monto!==1)throw Error('create-not-confirmed');
      onStep('Creación comprobada. Editando el registro ficticio…');
      await db.runTransaction(async tx=>{const m=await tx.get(meta),s=await tx.get(ref);if(!s.exists||!matches(s.data(),id,timestamp)||s.data().monto!==1)throw Error('probe-content-changed');advance(tx,meta,m);tx.update(ref,{monto:2});});
      const edited=await ref.get({source:'server'});
      if(!edited.exists||!matches(edited.data(),id,timestamp)||edited.data().monto!==2)throw Error('edit-not-confirmed');
      success=true;
    }catch(e){errorCode=['probe-collision','probe-content-changed','unexpected-meta','create-not-confirmed','edit-not-confirmed'].includes(e.message)?e.message:'request-failed';}
    if(collision)return {success:false,cleaned:false,id,errorCode};
    onStep('Eliminando el registro ficticio y comprobando su ausencia…');
    try{await cleanup({db,uid,id,timestamp});return {success,cleaned:true,id,errorCode};}
    catch{return {success:false,cleaned:false,id,errorCode:'cleanup-not-confirmed'};}
  }
  return {run,cleanup};
});
