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
test('importación inválida informa campos y conteos sin exponer valores ni escribir',async()=>{
  const app=await loadApp([fixture()]);
  app.context.upload={contents:JSON.stringify({records:[fixture({monto:'private-amount',desc:'',fecha:'private-date'}),fixture({monto:'another-private-amount'})]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();
  const message=app.alerts.at(-1);
  assert.match(message,/monto: 2/);assert.match(message,/desc: 1/);assert.match(message,/fecha \(formato incompatible\): 1/);
  assert.doesNotMatch(message,/private-amount|private-date/);assert.equal(app.mockWrites.length,0);assert.equal(app.run('records.length'),1);
});
test('campos desconocidos no se reflejan como nombres privados en el diagnóstico',async()=>{
  const app=await loadApp([]);
  app.context.upload={contents:JSON.stringify({records:[{...fixture(),'private-field-name':'private-value'}]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();
  assert.match(app.alerts.at(-1),/campos adicionales: 1/);assert.doesNotMatch(app.alerts.at(-1),/private-field-name|private-value/);assert.equal(app.mockWrites.length,0);
});
test('respaldo legado del ajuste automático es compatible y cancelar no modifica datos',async()=>{
  const app=await loadApp([fixture()],{confirm:false});
  app.context.upload={contents:JSON.stringify({records:[{tipo:'rendimiento',monto:-5,desc:'Ajuste automático sintético',fecha:'01/01/2026',clp:0,tc:0,etf:''}]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();
  assert.equal(app.alerts.length,0);assert.equal(app.mockWrites.length,0);assert.equal(app.run('records[0].monto'),100);
});
test('JSON nulo o sin records se rechaza de forma específica y sin guardado',async()=>{
  for(const contents of ['null','[]','{}']){const app=await loadApp([]);app.context.upload={contents};app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();assert.match(app.alerts.at(-1),/no contiene la lista/);assert.equal(app.mockWrites.length,0);}
});
test('fechas legadas conservan exactamente día mes y año al normalizar formato',async()=>{
  const app=await loadApp([]);
  for(const [input,expected] of [['1/2/2026','01/02/2026'],['01-02-2026','01/02/2026'],['2026-02-01','01/02/2026'],[' 29/2/2024 ','29/02/2024'],['31/12/2200','31/12/2200']]){
    app.context.dateInput=input;assert.equal(app.run('normalizarFechaLegada(dateInput)'),expected);
  }
});
test('normalización nunca inventa fechas vacías imposibles ambiguas ni con zona horaria',async()=>{
  const app=await loadApp([]);
  for(const input of ['',null,undefined,1234,'29/02/2025','31/04/2026','01/13/2026','01/01/1899','01/01/2201','01-02/2026','02.01.2026','2026-02-01T23:00:00-03:00']){
    app.context.dateInput=input;assert.equal(app.run('normalizarFechaLegada(dateInput)'),null);
  }
});
test('cancelar normalización de dos fechas no escribe ni cambia respaldo o vista',async()=>{
  const app=await loadApp([fixture()],{confirm:false});
  const contents=JSON.stringify({records:[fixture({fecha:'1/2/2026'}),fixture({fecha:'2026-02-03'})]});app.context.upload={contents};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();
  assert.equal(app.alerts.length,0);assert.match(app.calls.confirmations.at(-1),/formato de 2 fecha/);assert.match(app.calls.confirmations.at(-1),/conservando día, mes y año/);
  assert.equal(app.context.upload.contents,contents);assert.equal(app.mockWrites.length,0);assert.equal(app.run('records.length'),1);assert.equal(app.run('records[0].fecha'),'01/01/2026');
});
test('confirmación de respaldo legado válido guarda la fecha canónica sin cambiar el monto',async()=>{
  const app=await loadApp([]);app.context.upload={contents:JSON.stringify({records:[fixture({fecha:'2026-02-03',monto:123})]})};
  app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();
  assert.equal(app.run('records[0].fecha'),'03/02/2026');assert.equal(app.run('records[0].monto'),123);assert.equal(app.store.dirty,false);assert.equal(app.store.revision,1);
  const saved=[...app.db.data.entries()].find(([key])=>key.includes('/movements/'))[1];assert.equal(saved.fecha.toDate().toISOString(),'2026-02-03T00:00:00.000Z');
});
test('respaldo versionado no convierte formatos fuera de su esquema y no oculta fechas imposibles',async()=>{
  for(const data of [{version:2,ownerUid:'user-a',records:[fixture({fecha:'2026-02-03'})]},{records:[fixture({fecha:'31/02/2026'})]},{records:[fixture({fecha:''})]}]){
    const app=await loadApp([]);app.context.upload={contents:JSON.stringify(data)};app.run("importarJSON({target:{files:[upload],value:'fake.json'}})");await settle();assert.equal(app.mockWrites.length,0);assert.equal(app.calls.confirmations.length,0);assert.match(app.alerts.at(-1),/fecha \(/);
  }
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
test('fallo de carga identifica etapa y código sin exponer errores privados',async()=>{
  const app=await loadApp([fixture()]);
  app.store.movements={limit:()=>({get:async()=>{throw Object.assign(Error('private-token-and-record'),{code:'permission-denied'});}})};
  await app.store.load(app.db.snapshot(app.store.meta.path));
  assert.equal(app.store.ready,false);
  assert.match(app.element('store-status').textContent,/consulta: permission-denied/);
  assert.doesNotMatch(app.element('store-status').textContent,/private-token-and-record/);
  assert.equal(app.run('records.length'),1);
});
test('metadatos inválidos se distinguen de fallo de consulta sin revelar contenido',async()=>{
  const app=await loadApp([]);
  app.db.data.set(app.store.meta.path,{schemaVersion:2,revision:'private-content'});
  await app.store.load(app.db.snapshot(app.store.meta.path));
  assert.match(app.element('store-status').textContent,/metadatos: invalid-revision/);
  assert.doesNotMatch(app.element('store-status').textContent,/private-content/);
  assert.equal(app.store.ready,false);
});
test('carga todas las páginas y ninguna consulta supera 500 documentos',async()=>{
  const list=Array.from({length:501},(_,i)=>fixture({id:'paged-'+String(i).padStart(5,'0'),orden:i}));
  const app=await loadApp([]);const original=app.store.movements,limits=[];
  app.db.seed('user-a',list);
  app.store.movements={limit:n=>{limits.push(n);if(n>500)throw Object.assign(Error('server-limit'),{code:'invalid-argument'});return original.limit(n);}};
  await app.store.load(app.db.snapshot(app.store.meta.path));
  assert.equal(app.store.ready,true);assert.equal(app.store.records.length,501);assert.deepEqual(limits,[500,500]);
});
test('portafolio que supera 10000 se rechaza sin mostrar una lista truncada',async()=>{
  const app=await loadApp([fixture()]);
  const list=Array.from({length:10001},(_,i)=>fixture({id:'overflow-'+String(i).padStart(5,'0'),orden:i}));
  app.db.seed('user-a',list);
  await app.store.load(app.db.snapshot(app.store.meta.path));
  assert.equal(app.store.ready,false);assert.equal(app.store.records.length,1);assert.match(app.element('store-status').textContent,/invalid-list/);
});
test('un portafolio de exactamente 10000 se carga completo',async()=>{
  const app=await loadApp([]);
  app.db.seed('user-a',Array.from({length:10000},(_,i)=>fixture({id:'boundary-'+String(i).padStart(5,'0'),orden:i})));
  await app.store.load(app.db.snapshot(app.store.meta.path));
  assert.equal(app.store.ready,true);assert.equal(app.store.records.length,10000);
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
test('ajuste automático fuera de límites no modifica registros ni crea un borrador inválido',async()=>{
  const app=await loadApp([fixture({monto:1e12}),fixture({monto:1e12})]);
  app.element('valor-actual-inp').value='0';
  app.run('registrarRendimientoAuto()');
  assert.equal(app.run('records.length'),2);
  assert.equal(app.store.dirty,false);assert.equal(app.mockWrites.length,0);
  assert.ok(app.alerts.some(msg=>msg.includes('límites')));
});
test('ajuste automático válido se guarda con el mismo esquema que los demás movimientos',async()=>{
  const app=await loadApp([fixture()]);
  app.element('valor-actual-inp').value='110';
  app.run('registrarRendimientoAuto()');
  assert.equal(await app.run('colaGuardado'),true);
  assert.equal(app.run('records.at(-1).tipo'),'rendimiento');
  assert.equal(app.run('records.at(-1).monto'),10);
});
test('Google verificado sin permiso administrativo no obtiene listener ni puede guardar',async()=>{
  const denied={...user('user-a'),async getIdTokenResult(){return {claims:{}};}};
  const app=await loadApp([],{user:denied});
  assert.equal(app.store.uid,null);assert.equal(app.db.listeners.size,0);
  assert.equal(await app.run('save()'),false);
});
test('token tardío de una sesión cancelada no vuelve a abrir el portafolio',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});
  const account={...user('user-a'),getIdTokenResult(){return pending;}};
  const app=await loadApp([fixture()],{user:account});
  assert.equal(app.store.uid,null);
  await app.changeUser(null);
  resolve({claims:{trackerAccess:true}});await settle();
  assert.equal(app.store.uid,null);assert.equal(app.run('records.length'),0);
});
