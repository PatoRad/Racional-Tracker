'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularRebalanceo } = require('../rebalanceador.js');
const objetivos = { VOO: 50, VXUS: 30, GLDM: 20 };
test('cartera vacía: compra ETF de mayor objetivo', () => {
  const r = calcularRebalanceo({ objetivos, valoresUSD: {VOO:0,VXUS:0,GLDM:0}, aporteUSD:100 });
  assert.equal(r.etf, 'VOO');
  assert.equal(r.totalDespuesUSD, 100);
});
test('elige ETF más rezagado según valor de mercado, no costo histórico', () => {
  const r = calcularRebalanceo({ objetivos, valoresUSD: {VOO:700,VXUS:100,GLDM:200}, aporteUSD:100 });
  assert.equal(r.etf, 'VXUS');
  assert.ok(r.porcentajesDespues.VXUS > r.porcentajesAntes.VXUS);
});
test('no divide aporte entre varios ETF', () => {
  const r = calcularRebalanceo({ objetivos, valoresUSD: {VOO:400,VXUS:400,GLDM:200}, aporteUSD:75 });
  assert.equal(r.totalDespuesUSD, 1075);
  assert.equal(r.porcentajesDespues.GLDM, 200/1075*100);
});
test('no muta la cartera recibida', () => {
  const valoresUSD = Object.freeze({VOO:500,VXUS:300,GLDM:200});
  calcularRebalanceo({objetivos, valoresUSD, aporteUSD:20});
  assert.deepEqual(valoresUSD, {VOO:500,VXUS:300,GLDM:200});
});
test('rechaza objetivos que no suman 100 y valores incompletos', () => {
  assert.throws(()=>calcularRebalanceo({objetivos:{VOO:99},valoresUSD:{VOO:10},aporteUSD:10}), /100/);
  assert.throws(()=>calcularRebalanceo({objetivos,valoresUSD:{VOO:10,VXUS:10},aporteUSD:10}), /valores/);
});
test('rechaza NaN, negativos, infinitos y aporte cero', () => {
  for (const n of [NaN,Infinity,-1]) assert.throws(()=>calcularRebalanceo({objetivos,valoresUSD:{VOO:n,VXUS:0,GLDM:0},aporteUSD:10}), /inválido/);
  assert.throws(()=>calcularRebalanceo({objetivos,valoresUSD:{VOO:0,VXUS:0,GLDM:0},aporteUSD:0}), /positivo/);
});
test('desempate determinista', () => {
  const r = calcularRebalanceo({objetivos:{VOO:50,VXUS:50},valoresUSD:{VOO:0,VXUS:0},aporteUSD:50});
  assert.equal(r.etf,'VOO');
});
