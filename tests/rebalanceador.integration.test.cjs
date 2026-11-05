'use strict';
// Integración con DOM/Firebase simulados: jamás conecta ni modifica datos reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../rebalanceador.js');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const source = scripts.at(-1)?.[1];
assert.ok(source && source.includes('function renderRebalanceador'));
function fixture() {
  const elements = new Map(), writes = [];
  function element(id='') {
    return {id, value:'', textContent:'', innerHTML:'', style:{}, dataset:{}, children:[],
      classList:{add(){},remove(){},contains(){return false;}},
      addEventListener(){}, appendChild(x){this.children.push(x);}, focus(){}};
  }
  const document = {
    getElementById(id) { if(!elements.has(id)) elements.set(id,element(id)); return elements.get(id); },
    createElement() { return element(); }, querySelectorAll(){return [];}, addEventListener(){}
  };
  const firebase = {initializeApp(){},firestore(){return {collection(){return {doc(){return {
    onSnapshot(){},set(data){writes.push(data);return Promise.resolve();}
  };}};}};}};
  const context = vm.createContext({document,firebase,window:{RacionalRebalanceador:engine},
    localStorage:{setItem(){},getItem(){return null;}},Chart:class{destroy(){}},
    setTimeout(){},alert(){},confirm(){return true;}});
  vm.runInContext(source,context,{filename:'index.html:inline',timeout:1500});
  const evaluate = expr => vm.runInContext(expr,context,{timeout:1500});
  const targets = JSON.parse(evaluate('JSON.stringify(ETF_TARGET)'));
  document.getElementById('rebalanceador-clp').value='25000';
  return {document,evaluate,targets,writes,el:id=>document.getElementById(id)};
}
function fill(f,values=100) {
  for (const e of Object.keys(f.targets)) f.el('rebalanceador-valor-'+e).value=String(
    typeof values==='number'?values:values[e]);
  f.el('rebalanceador-tc').value='950';
}
test('inicia la tarjeta con seis entradas sin escritura de Firestore',()=>{
  const f=fixture();
  assert.equal(f.el('rebalanceador-valores').children.length,6);
  assert.equal(f.writes.length,0);
});
test('bloquea valores incompletos',()=>{
  const f=fixture();
  f.evaluate('renderRebalanceador()');
  assert.match(f.el('rebalanceador-resultado').textContent,/Introduce todos/);
  assert.equal(f.writes.length,0);
});
test('simula compra única desde UI sin modificar registros',()=>{
  const f=fixture();
  const values={VOO:700,VXUS:100,VWO:150,XLE:80,GLDM:100,VNQ:70};
  fill(f,values);
  f.evaluate('renderRebalanceador()');
  assert.match(f.el('rebalanceador-resultado').textContent,/Simulación: aportar/);
  assert.equal(f.writes.length,0);
  assert.equal(f.evaluate('records.length'),0);
});
test('rechaza tipo de cambio cero',()=>{
  const f=fixture();fill(f);f.el('rebalanceador-tc').value='0';
  f.evaluate('renderRebalanceador()');
  assert.match(f.el('rebalanceador-resultado').textContent,/tipo de cambio válidos/);
});
test('rechaza valoración negativa',()=>{
  const f=fixture();fill(f);f.el('rebalanceador-valor-VOO').value='-2';
  f.evaluate('renderRebalanceador()');
  assert.match(f.el('rebalanceador-resultado').textContent,/Valor de mercado inválido/);
  assert.equal(f.writes.length,0);
});
test('conserva objetivos normalizados al 100%',()=>{
  const f=fixture();
  assert.ok(Math.abs(Object.values(f.targets).reduce((s,n)=>s+n,0)-100)<1e-9);
});
