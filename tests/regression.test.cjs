'use strict';

// Pruebas de regresion RED: describen comportamiento esperado y fallan
// hasta que se corrijan los defectos de index.html.
// Ejecucion: node --test tests/regression.test.cjs
// SEGURIDAD: Firebase, localStorage, Chart.js y FileReader son simulados.
// No se hacen peticiones ni escrituras a servicios externos.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const source = scripts.at(-1)?.[1];
assert.ok(source && source.includes('function updateKPIs'), 'No se encontro el script de la aplicacion');

function fixture(overrides = {}) {
  return {
    tipo: 'aporte', monto: 100, desc: 'Deposito sintetico',
    fecha: '01/01/2026', hora: '12:00', clp: 0, tc: 0,
    etf: '', acciones: 0, ...overrides
  };
}

function loadApp(initialRecords = []) {
  const elements = new Map();
  const mockWrites = [];
  const fakeDocument = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          value: '', textContent: '', innerHTML: '', className: '',
          style: {}, dataset: {},
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          focus() {}, addEventListener() {}, appendChild() {}
        });
      }
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    createElement() { return { id:'', value:'', textContent:'', innerHTML:'', style:{}, dataset:{}, children:[], addEventListener(){}, appendChild(node){this.children.push(node);}, classList:{add(){},remove(){}} }; },
    addEventListener() {}
  };
  const firestore = {
    collection() {
      return {
        doc() {
          return {
            onSnapshot() { /* Sin listener real */ },
            set(payload) {
              mockWrites.push(JSON.stringify(payload));
              return Promise.resolve();
            }
          };
        }
      };
    }
  };
  class FakeFileReader {
    readAsText(file) {
      this.onload({ target: { result: file.contents } });
    }
  }
  class FakeChart {
    destroy() {}
  }
  const context = vm.createContext({
    document: fakeDocument,
    firebase: { initializeApp() {}, firestore() { return firestore; } },
    localStorage: { setItem() {}, getItem() { return null; } },
    window: {}, Chart: FakeChart, FileReader: FakeFileReader,
    setTimeout() {}, alert() {}, confirm() { return true; }
  });
  vm.runInContext(source, context, { filename: 'index.html:inline', timeout: 1000 });
  context.testRecords = structuredClone(initialRecords);
  vm.runInContext('records = testRecords', context);
  return {
    element: id => fakeDocument.getElementById(id),
    run: expression => vm.runInContext(expression, context, { timeout: 1000 }),
    context,
    mockWrites
  };
}

test('base: la aplicacion inicializa en entorno aislado sin Firebase real', () => {
  const app = loadApp();
  assert.equal(app.mockWrites.length, 0);
  assert.equal(app.run('typeof updateKPIs'), 'function');
});

test('base: la descripcion de un movimiento se escapa para HTML', () => {
  const app = loadApp([fixture({ desc: '<img src=x onerror=alert(1)>' })]);
  app.run('renderTabla()');
  assert.match(app.element('tbody').innerHTML, /&lt;img src=x/);
});

test('P1: los rendimientos negativos deben mostrarse con signo menos', () => {
  const app = loadApp([
    fixture(),
    fixture({ tipo: 'rendimiento', monto: -20, desc: 'Perdida sintetica' })
  ]);
  app.run('updateKPIs()');
  assert.equal(app.element('kr').textContent, '-$20.00');
});

test('P1: una venta parcial rentable no debe eliminar posiciones que siguen abiertas', () => {
  const app = loadApp([
    fixture({ tipo: 'compra', monto: 100, acciones: 2, etf: 'VOO' }),
    fixture({ tipo: 'venta', monto: 120, acciones: 1, etf: 'VOO', fecha: '01/02/2026' })
  ]);
  const cost = app.run('calcCostoPromedio()');
  const allocation = app.run('calcEtfReal()');
  assert.equal(cost.res.VOO.acc, 1, 'Queda una accion VOO');
  assert.ok(allocation.compras.VOO > 0, 'La posicion remanente debe ser mayor que cero');
});

test('P1: la hora importada no debe inyectar etiquetas HTML en la tabla', () => {
  const app = loadApp([
    fixture({ hora: '12:00<img src=x onerror=alert(1)>' })
  ]);
  app.run('renderTabla()');
  assert.doesNotMatch(app.element('tbody').innerHTML, /<img\b/i);
});

test('P1: importar JSON con montos invalidos no debe reemplazar los registros', () => {
  const app = loadApp([fixture()]);
  app.context.upload = {
    contents: JSON.stringify({
      records: [{ tipo: 'aporte', monto: 'no-es-numero', fecha: '01/01/2026', desc: 'Invalido' }]
    })
  };
  app.run("importarJSON({target:{files:[upload],value:'ficticio.json'}})");
  assert.equal(app.run('records[0].monto'), 100, 'La importacion invalida debe rechazarse');
});

test('P2: las ponderaciones objetivo declaradas deben sumar 100%', () => {
  const app = loadApp();
  assert.equal(app.run('Object.values(ETF_TARGET).reduce((a,b) => a+b, 0)'), 100);
});

test('P1: valida movimientos reales en formato antes de importar', () => {
  const app = loadApp();
  const valido = fixture();
  app.context.candidato = valido;
  assert.equal(app.run('validarMovimiento(candidato)'), true);
  app.context.candidato = fixture({ fecha: '31/02/2026' });
  assert.equal(app.run('validarMovimiento(candidato)'), false);
  app.context.candidato = fixture({ hora: '12:00<img src=x>' });
  assert.equal(app.run('validarMovimiento(candidato)'), false);
});
