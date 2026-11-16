const test=require('node:test');
const assert=require('node:assert/strict');
const {loadApp,fixture}=require('./helpers.cjs');

test('depósitos, retiros, dividendos y ajustes separados; operaciones internas no duplican aportes',async()=>{
  const app=await loadApp([
    fixture({monto:1000}),fixture({tipo:'retiro',monto:200}),
    fixture({tipo:'compra',monto:800,etf:'VOO'}),fixture({tipo:'venta',monto:100,etf:'VOO'}),
    fixture({tipo:'dividendo',monto:30}),fixture({tipo:'rendimiento',monto:-50}),
    fixture({tipo:'comision',monto:5}),fixture({tipo:'rebalanceo',monto:500})
  ]);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(resumenLibro())')),
    {depositos:1000,retiros:200,neto:800,dividendos:30,ajustes:-50,comisiones:5,saldo:775});
  assert.match(app.element('stat-row2').innerHTML,/Dividendos registrados/);
  assert.match(app.element('stat-row2').innerHTML,/Ajustes registrados/);
  assert.equal(app.run('calcXIRR()'),null);
  assert.equal(app.mockWrites.length,0);
});

test('historial ordena meses y años y acumula retiros sin contar compras ni dividendos',async()=>{
  const app=await loadApp([
    fixture({fecha:'01/02/2026',tipo:'retiro',monto:150}),
    fixture({fecha:'01/12/2025',monto:100}),fixture({fecha:'02/12/2025',monto:50}),
    fixture({fecha:'01/01/2026',tipo:'compra',monto:100,etf:'VOO'}),
    fixture({fecha:'01/01/2026',tipo:'dividendo',monto:10}),
    fixture({fecha:'01/03/2026',tipo:'retiro',monto:20})
  ]);
  const rows=JSON.parse(app.run('JSON.stringify(historialAportes())'));
  assert.deepEqual(rows.map(x=>[x.label,x.depositos,x.retiros,x.neto,x.acumulado]),
    [['12/2025',150,0,150,150],['02/2026',0,150,-150,0],['03/2026',0,20,-20,-20]]);
  assert.match(app.element('prox-body').innerHTML,/Neto acumulado/);
  assert.equal(app.mockWrites.length,0);
});

test('libro vacío no inventa mercado ni historial',async()=>{
  const app=await loadApp([]);
  assert.equal(app.run('resumenLibro().saldo'),0);
  assert.match(app.element('prox-body').innerHTML,/Sin depósitos ni retiros/);
  assert.equal(app.run('calcXIRR()'),null);
});

test('conciliación descuenta dividendos y comisiones una sola vez y repetir no crea otro ajuste',async()=>{
  const app=await loadApp([fixture(),fixture({tipo:'dividendo',monto:10}),fixture({tipo:'comision',monto:2})]);
  app.element('valor-actual-inp').value='120';app.run('registrarRendimientoAuto()');
  await app.run('colaGuardado');
  assert.equal(app.run('records.at(-1).monto'),12);
  assert.equal(app.run('resumenLibro().saldo'),120);
  app.element('valor-actual-inp').value='120';app.run('registrarRendimientoAuto()');
  assert.equal(app.run('records.length'),4);
});

test('conciliación parte del saldo firmado, sin ocultar saldos negativos',async()=>{
  const app=await loadApp([fixture({tipo:'comision',monto:5})]);
  assert.equal(app.run('resumenLibro().saldo'),-5);
  app.element('valor-actual-inp').value='0';app.run('registrarRendimientoAuto()');
  await app.run('colaGuardado');
  assert.equal(app.run('records.at(-1).monto'),5);
  assert.equal(app.run('resumenLibro().saldo'),0);
});

test('refrescar no cambia registros históricos ni escribe datos',async()=>{
  const app=await loadApp([fixture(),fixture({tipo:'rendimiento',monto:10,desc:'Ajuste automático (valor Racional: $110)'})]);
  const before=app.run('JSON.stringify(records)');
  app.run('refresh(); refresh()');
  assert.equal(app.run('JSON.stringify(records)'),before);
  assert.equal(app.mockWrites.length,0);
});
