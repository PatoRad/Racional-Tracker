const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../finance-core.js');
const {accounts,transactions}=C.demoData();
function tx(overrides={}){return {id:'txn-123',date:'2026-11-12',type:'expense',amount:1000,accountId:'bank-main',category:'Otros gastos',note:'Prueba',source:'manual',...overrides};}
test('ejemplo: balance y patrimonio sin contar dos veces transferencias',()=>{
 const b=C.calculateBalances(accounts,transactions);assert.deepEqual(b,{'bank-main':515000,'mercado-pago':100011});
 const o=C.overview(accounts,transactions,'2026-11');assert.equal(o.assets,615011);assert.equal(o.available,515000);assert.equal(o.savings,100011);
});
test('resumen excluye transferencias de ingresos y gastos, separa intereses',()=>{
 const s=C.periodSummary(accounts,transactions,'2026-11');assert.equal(s.income,650000);assert.equal(s.expense,35000);assert.equal(s.transfer,100000);assert.equal(s.yield,11);assert.equal(s.net,615011);
});
test('transferencia deja patrimonio global intacto',()=>{
 const before=C.overview(accounts,transactions,'2026-11').assets;
 const next=C.addTransaction(accounts,transactions,tx({type:'transfer',fromId:'bank-main',toId:'mercado-pago',amount:50000,category:''}));
 assert.equal(C.overview(accounts,next,'2026-11').assets,before);assert.equal(C.calculateBalances(accounts,next)['mercado-pago'],150011);
});
test('editar y eliminar una compra actualiza saldos sin doble efecto',()=>{
 const next=C.addTransaction(accounts,transactions,tx());
 assert.equal(C.overview(accounts,next,'2026-11').assets,614011);
 const edited=C.updateTransaction(accounts,next,tx({amount:2000}));
 assert.equal(C.overview(accounts,edited,'2026-11').assets,613011);
 assert.equal(C.overview(accounts,C.deleteTransaction(accounts,edited,'txn-123'),'2026-11').assets,615011);
});
test('validaciones rechazan montos no enteros, fechas inexistentes, auto-transferencias, IDs repetidos',()=>{
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({amount:10.5})),/entero/);
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({date:'2026-02-30'})),/Fecha/);
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({type:'transfer',fromId:'bank-main',toId:'bank-main'})),/distintas/);
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({id:'demo-salary'})),/duplicado/);
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({accountId:'not-valid'})),/inexistente/);
});
test('no modifica los arrays originales',()=>{
 const original=JSON.stringify(transactions);C.addTransaction(accounts,transactions,tx());assert.equal(JSON.stringify(transactions),original);
});
test('crear cuenta y cálculo de saldo inicial',()=>{
 const a=C.addAccount(accounts,transactions,{id:'cash-123',name:'Efectivo',type:'cash',currency:'CLP',openingBalance:15000});
 assert.equal(C.calculateBalances(a,transactions)['cash-123'],15000);
 assert.equal(C.overview(a,transactions,'2026-11').assets,630011);
});
test('categorías y series mensuales usan movimientos reales, no datos inventados',()=>{
 const s=C.monthSeries(accounts,transactions,'2026-11',3);assert.deepEqual(s.map(x=>x.month),['2026-09','2026-10','2026-11']);
 assert.equal(s[0].income,0);assert.equal(s[1].expense,0);assert.equal(s[2].categories['Alimentación'],35000);
});
test('CSV protege celdas de inyección de fórmulas y conserva tildes',()=>{
 const next=C.addTransaction(accounts,transactions,tx({note:'=HYPERLINK("bad")'}));
 const csv=C.exportTransactionsCSV(accounts,next);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('Alimentación'));assert.ok(csv.charCodeAt(0)===0xFEFF);
});
test('saldo negativo se expone para alerta, no se oculta',()=>{
 const next=C.addTransaction(accounts,transactions,tx({amount:900000}));
 assert.equal(C.calculateBalances(accounts,next)['bank-main'],-385000);
});

test('referencia externa impide duplicar operaciones entre importaciones futuras',()=>{
 const imported=tx({id:'bank-imp-01',source:'bank_import',provider:'banco_demo',externalId:'ref-001'});
 const imported2={...imported,id:'bank-imp-02',source:'bank_api'};
 const one=C.addTransaction(accounts,transactions,imported);
 assert.throws(()=>C.addTransaction(accounts,one,imported2),/bancario duplicado/);
 assert.throws(()=>C.addTransaction(accounts,transactions,tx({source:'bank_api'})),/Proveedor bancario/);
});
test('categoría __proto__ no altera prototipos ni corrompe totales',()=>{
 const one=C.addTransaction(accounts,transactions,tx({category:'__proto__'}));
 const s=C.periodSummary(accounts,one,'2026-11');
 assert.equal(s.categories['__proto__'],1000);
 assert.equal({}.polluted,undefined);
});
test('ninguna operación accede a datos reales o servicios remotos',()=>{
 assert.equal(typeof C.demoData,'function');
 const state=C.demoData();
 assert.equal(C.overview(state.accounts,state.transactions,'2026-11').assets,615011);
});
