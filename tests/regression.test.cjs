'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadApp,fixture} = require('./helpers.cjs');

test('base: la aplicacion inicializa en entorno aislado sin Firebase real', async () => {
  const app = await loadApp();
  assert.equal(app.mockWrites.length, 0);
  assert.equal(app.run('typeof updateKPIs'), 'function');
});

test('base: la descripcion de un movimiento se escapa para HTML', async () => {
  const app = await loadApp([fixture({ desc: '<img src=x onerror=alert(1)>' })]);
  app.run('renderTabla()');
  assert.match(app.element('tbody').innerHTML, /&lt;img src=x/);
});

test('P1: los rendimientos negativos deben mostrarse con signo menos', async () => {
  const app = await loadApp([
    fixture(),
    fixture({ tipo: 'rendimiento', monto: -20, desc: 'Perdida sintetica' })
  ]);
  app.run('updateKPIs()');
  assert.equal(app.element('kr').textContent, '-$20.00');
});

test('P1: una venta parcial rentable no debe eliminar posiciones que siguen abiertas', async () => {
  const app = await loadApp([
    fixture({ tipo: 'compra', monto: 100, acciones: 2, etf: 'VOO' }),
    fixture({ tipo: 'venta', monto: 120, acciones: 1, etf: 'VOO', fecha: '01/02/2026' })
  ]);
  const cost = app.run('calcCostoPromedio()');
  const allocation = app.run('calcEtfReal()');
  assert.equal(cost.res.VOO.acc, 1, 'Queda una accion VOO');
  assert.ok(allocation.compras.VOO > 0, 'La posicion remanente debe ser mayor que cero');
});

test('P1: la hora importada no debe inyectar etiquetas HTML en la tabla', async () => {
  const app = await loadApp([
    fixture({ hora: '12:00<img src=x onerror=alert(1)>' })
  ]);
  app.run('renderTabla()');
  assert.doesNotMatch(app.element('tbody').innerHTML, /<img\b/i);
});

test('P1: importar JSON con montos invalidos no debe reemplazar los registros', async () => {
  const app = await loadApp([fixture()]);
  app.context.upload = {
    contents: JSON.stringify({
      records: [{ tipo: 'aporte', monto: 'no-es-numero', fecha: '01/01/2026', desc: 'Invalido' }]
    })
  };
  app.run("importarJSON({target:{files:[upload],value:'ficticio.json'}})");
  assert.equal(app.run('records[0].monto'), 100, 'La importacion invalida debe rechazarse');
});

test('P2: las ponderaciones objetivo declaradas deben sumar 100%', async () => {
  const app = await loadApp();
  assert.equal(app.run('Object.values(ETF_TARGET).reduce((a,b) => a+b, 0)'), 100);
});

test('P1: valida movimientos reales en formato antes de importar', async () => {
  const app = await loadApp();
  const valido = fixture();
  app.context.candidato = valido;
  assert.equal(app.run('validarMovimiento(candidato)'), true);
  app.context.candidato = fixture({ fecha: '31/02/2026' });
  assert.equal(app.run('validarMovimiento(candidato)'), false);
  app.context.candidato = fixture({ hora: '12:00<img src=x>' });
  assert.equal(app.run('validarMovimiento(candidato)'), false);
});


test('nombre de activo heredado de Object.prototype no contamina cálculos ni prototipos', async () => {
  const app = await loadApp([fixture({tipo:'compra',etf:'__proto__',acciones:1})]);
  app.run('calcCostoPromedio()');
  assert.equal(app.run("Object.prototype.hasOwnProperty.call(Object.prototype,'acc')"),false);
  assert.equal(app.run("Object.prototype.hasOwnProperty.call(Object.prototype,'costo')"),false);
  assert.equal(app.run('calcEtfReal().totalCompras'),0);
});