'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadApp,fixture,user,settle} = require('./helpers.cjs');

test('no inicia Firebase ni accede a nube si falta configurar App Check',async()=>{
  const app=await loadApp([], {config:{appCheckSiteKey:'',requireAppCheck:true}});
  assert.equal(app.calls.init,0);assert.equal(app.store,null);
  assert.equal(app.element('signin-btn').disabled,true);
});
test('sin sesión no carga datos ni permite guardados o recuperar respaldos heredados',async()=>{
  const app=await loadApp([], {user:null,storage:{libro_records_backup:JSON.stringify([fixture()])}});
  assert.equal(app.store.uid,null);assert.equal(app.run('records.length'),0);
  assert.equal(await app.run('save()'),false);
  app.run('recuperarRespaldo()');
  assert.equal(app.run('records.length'),0);assert.equal(app.mockWrites.length,0);
});
test('sesión Google activa App Check y separa rutas por UID sin ruta heredada',async()=>{
  const app=await loadApp([fixture()]);
  assert.equal(app.calls.appcheck,1);
  assert.equal(app.store.uid,'user-a');assert.equal(app.store.loaded,true);
  assert.ok(app.store.meta.path.startsWith('users/user-a/'));
  assert.ok([...app.db.listeners.keys()].every(path=>!path.startsWith('libro/')));
});
test('inicio con Google selecciona cuenta y utiliza persistencia de sesión',async()=>{
  const app=await loadApp([], {user:null});
  await app.run('iniciarSesion()');
  assert.ok(app.calls.persistence.every(value=>value==='session'));
  assert.equal(app.calls.popup,1);assert.equal(app.calls.provider.prompt,'select_account');
});
test('error de popup no muestra datos ni deshabilita permanentemente el acceso',async()=>{
  const app=await loadApp([], {user:null,popupFail:true});
  await app.run('iniciarSesion()');
  assert.equal(app.run('records.length'),0);assert.equal(app.element('signin-btn').disabled,false);
});
test('cambio de cuenta borra movimientos, formularios y filtros privados',async()=>{
  const app=await loadApp([fixture()]);
  app.element('f-desc').value='dato de A';app.element('meta-inp').value='999';
  app.db.seed('user-b',[fixture({monto:200})],1);
  await app.changeUser(user('user-b'));
  assert.equal(app.run('records[0].monto'),200);
  assert.equal(app.element('f-desc').value,'');assert.equal(app.element('meta-inp').value,'');
  assert.equal(app.db.listeners.size,1);
});
test('proveedores inválidos y correo no verificado no obtienen listener',async()=>{
  for(const invalid of [{...user('user-a'),emailVerified:false},{...user('user-a'),providerData:[{providerId:'password'}]}]) {
    const app=await loadApp([],{user:invalid});
    assert.equal(app.store.uid,null);assert.equal(app.db.listeners.size,0);
  }
});
test('respuesta de lectura pendiente de cuenta anterior no aparece en la nueva sesión',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});
  const options={queryDeferred:pending};
  const app=await loadApp([fixture()],options);
  assert.equal(app.store.loaded,false);
  await app.changeUser(null);
  resolve();await settle();
  assert.equal(app.run('records.length'),0);assert.equal(app.store.uid,null);
});
test('serializa guardados y mantiene identificadores estables',async()=>{
  const app=await loadApp([fixture()]);
  app.context.secondRecord=fixture({monto:20});
  app.context.thirdRecord=fixture({monto:30});
  app.run('records.push(secondRecord); first=save(); records.push(thirdRecord); second=save()');
  assert.equal(await app.context.first,true);assert.equal(await app.context.second,true);
  assert.deepEqual(app.db.savedStates,[2,3]);
  assert.equal(new Set(app.run('records.map(r=>r.id)')).size,3);
});
test('cambio remoto concurrente rechaza el guardado sin pérdida del borrador local',async()=>{
  const app=await loadApp([fixture()]);
  app.context.draft=fixture({monto:20});
  app.run('records.push(draft)');
  // Cambia el servidor sin entregar el listener: la transacción debe detectarlo.
  app.db.seed('user-a',[fixture({monto:999})]);
  assert.equal(await app.run('save()'),false);
  assert.equal(app.mockWrites.length,0);assert.equal(app.run('records.length'),2);
  app.db.emit('user-a');await settle();
  assert.equal(app.run('records.length'),2);
});
test('también detecta cambio administrativo de un movimiento sin avanzar revisión',async()=>{
  const app=await loadApp([fixture()]);
  const path=app.store.movements.doc(app.run('records[0].id')).path;
  app.db.data.get(path).monto=999;
  app.run('records[0].monto=200');
  assert.equal(await app.run('save()'),false);assert.equal(app.mockWrites.length,0);
});
test('eliminación es atómica con metadatos y no borra otros movimientos',async()=>{
  const app=await loadApp([fixture(),fixture({monto:200})]);
  app.run('eliminar(0)');
  assert.equal(await app.run('colaGuardado'),true);
  assert.equal(app.run('records.length'),1);assert.equal(app.run('records[0].monto'),200);
  assert.ok(app.mockWrites.some(op=>op.delete));
});
test('actualización de un movimiento mantiene ID y orden originales',async()=>{
  const app=await loadApp([fixture()]);
  const id=app.run('records[0].id'),order=app.run('records[0].orden');
  app.run('openEdit(0)');
  app.element('m-desc').value='editado';app.element('m-fecha').value='2026-01-01';
  app.element('m-monto').value='150';app.run('saveEdit()');
  assert.equal(await app.run('colaGuardado'),true);
  assert.equal(app.run('records[0].id'),id);assert.equal(app.run('records[0].orden'),order);
});
test('edición abierta no sobrescribe un movimiento que cambió desde otra sesión',async()=>{
  const app=await loadApp([fixture()]);
  app.run('openEdit(0)');
  await app.snapshot([fixture({monto:999})]);
  app.run('saveEdit()');
  assert.equal(app.mockWrites.length,0);
  assert.ok(app.alerts.some(msg=>msg.includes('cambió')));
});
test('fallo de almacenamiento local permite guardado remoto e informa ausencia de respaldo',async()=>{
  const app=await loadApp([fixture()],{storageFails:true});
  app.run('records[0].monto=120');
  assert.equal(await app.run('save()'),true);
  assert.equal(app.store.dirty,false);
  // El estado posterior puede mostrar sincronizado; el error de respaldo no debe ocultarse.
  assert.match(app.element('store-status').textContent,/respaldo local no disponible/i);
});
test('respaldo corrupto o de otra cuenta no sustituye la vista',async()=>{
  const app=await loadApp([fixture()]);
  app.storage.set(app.store.key,JSON.stringify({version:2,uid:'user-b',records:[fixture({monto:999})]}));
  app.run('recuperarRespaldo()');
  assert.equal(app.run('records[0].monto'),100);assert.equal(app.mockWrites.length,0);
  app.storage.set(app.store.key,'invalid json');app.run('recuperarRespaldo()');
  assert.equal(app.run('records[0].monto'),100);
});
test('recuperación local validada no escribe nube ni se pisa con snapshots',async()=>{
  const app=await loadApp([fixture()]);
  app.storage.set(app.store.key,JSON.stringify({version:2,uid:'user-a',records:[fixture({monto:44})]}));
  app.run('recuperarRespaldo()');await app.snapshot([fixture({monto:999})]);
  assert.equal(app.run('records[0].monto'),44);assert.equal(app.mockWrites.length,0);
});
test('cada cuenta conserva su respaldo y nunca recupera el de la otra',async()=>{
  const app=await loadApp([fixture()]);
  app.run('records[0].monto=120');await app.run('save()');
  const key=app.store.key;
  await app.changeUser(user('user-b'));
  assert.notEqual(app.store.key,key);app.run('recuperarRespaldo()');
  assert.equal(app.run('records.length'),0);
  assert.equal(JSON.parse(app.storage.get(key)).uid,'user-a');
});
test('respaldo anterior conserva la versión previa y se recupera sin escritura',async()=>{
  const app=await loadApp([fixture()]);
  app.run('records[0].monto=120');await app.run('save()');
  app.run('records[0].monto=140');await app.run('save()');
  const writes=app.mockWrites.length;
  app.run('recuperarRespaldo(true)');
  assert.equal(app.run('records[0].monto'),120);assert.equal(app.mockWrites.length,writes);
});
test('error de nube durante importación conserva vista importada y respaldo previo',async()=>{
  const app=await loadApp([fixture()],{failWrite:true});
  app.context.upload={contents:JSON.stringify({records:[fixture({monto:44})]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");
  await app.run('colaGuardado');
  assert.equal(app.run('records[0].monto'),44);
  assert.equal(JSON.parse(app.storage.get(app.store.key+':previous')).records[0].monto,100);
});
test('importación versionada de otra cuenta se rechaza antes de cambiar vista',async()=>{
  const app=await loadApp([fixture()]);
  app.context.upload={contents:JSON.stringify({version:2,ownerUid:'user-b',records:[fixture({monto:999})]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");
  assert.equal(app.run('records[0].monto'),100);assert.equal(app.mockWrites.length,0);
});
test('IDs duplicados, campos extra y montos fuera de límites se rechazan',async()=>{
  const app=await loadApp([fixture()]);
  app.context.invalid=fixture({role:'admin'});
  assert.equal(app.run('validarMovimiento(invalid)'),false);
  app.context.invalid=fixture({monto:1e12+1});
  assert.equal(app.run('validarMovimiento(invalid)'),false);
  app.context.invalid=[fixture({id:'duplicate-01'}),fixture({id:'duplicate-01'})];
  assert.throws(()=>app.run('store.normalize(invalid)'));
});
test('más de 400 cambios no se envían parcialmente',async()=>{
  const app=await loadApp([]);
  app.context.many=Array.from({length:401},(_,orden)=>fixture({orden}));
  app.run('records=many');
  assert.equal(await app.run('save()'),false);
  assert.equal(app.mockWrites.length,0);assert.equal(app.run('records.length'),401);
});
test('beforeunload protege borradores locales y cerrar sesión limpia vista',async()=>{
  const app=await loadApp([fixture()],{failWrite:true});
  app.run('records[0].monto=120');await app.run('save()');
  const event={preventDefault(){this.prevented=true;}};
  app.events.beforeunload(event);assert.equal(event.prevented,true);
  await app.run('cerrarSesion()');await settle();
  assert.equal(app.run('records.length'),0);assert.equal(app.store.uid,null);
});
test('error de nube no se presenta como sincronización exitosa',async()=>{
  const app=await loadApp([fixture()]);
  app.db.listeners.get(app.store.meta.path).error(Error('permission-denied'));
  assert.equal(app.store.ready,false);
  assert.match(app.element('store-status').textContent,/No se pudo/);
});
test('datos remotos inválidos se rechazan sin reemplazar una copia válida',async()=>{
  const app=await loadApp([fixture()]);
  const path=app.store.movements.doc(app.run('records[0].id')).path;
  app.db.data.get(path).role='admin';app.db.emit('user-a');await settle();
  assert.equal(app.run('records[0].monto'),100);assert.equal(app.store.ready,false);
});
test('fallo al configurar persistencia no inicia listeners de datos',async()=>{
  const app=await loadApp([],{persistenceFail:true});
  assert.equal(app.store,null);assert.equal(app.db.listeners.size,0);
  assert.equal(app.element('signin-btn').disabled,true);
});
test('error de autenticación limpia también identidad visible y acciones privadas',async()=>{
  const app=await loadApp([fixture()]);
  await app.authError();
  assert.equal(app.element('account-label').textContent,'');
  assert.equal(app.element('private-actions').hidden,true);
  assert.equal(app.run('records.length'),0);
});