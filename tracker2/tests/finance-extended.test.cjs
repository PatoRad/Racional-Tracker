const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../finance-core'),B=require('../finance-backup'),I=require('../finance-investments');
const {accounts,transactions}=C.demoData();
function usd(){return C.addAccount(accounts,transactions,{id:'usd-bank',name:'Dólares',type:'checking',currency:'USD',openingBalance:5000});}
test('cuenta USD conserva centavos enteros sin mezclarlos con pesos',()=>{
 const a=usd(),view=C.overview(a,transactions,'2026-11');assert.equal(view.assets,615011);assert.equal(view.byCurrency.USD.assets,5000);assert.equal(view.consolidatedCLP,null);
 assert.equal(C.overview(a,transactions,'2026-11',950).consolidatedCLP,662511);
 assert.equal(C.parseMinor('15.25','USD'),1525);assert.equal(C.parseMinor('100000','CLP'),100000);
 assert.throws(()=>C.parseMinor('1.255','USD'),/Monto inválido/);
});
test('transferencias entre monedas registran importes exactos y no crean ingresos',()=>{
 const a=usd(),x={id:'fx-transfer',date:'2026-11-12',type:'transfer',amount:9500,toAmount:1000,fromId:'bank-main',toId:'usd-bank',category:'',note:'Cambio de divisas',source:'manual'};
 const withTx=C.addTransaction(a,transactions,x),b=C.calculateBalances(a,withTx);
 assert.equal(b['bank-main'],505500);assert.equal(b['usd-bank'],6000);
 assert.equal(C.periodSummary(a,withTx,'2026-11').income,650000);
 assert.equal(C.periodSummary(a,withTx,'2026-11').net,615011);
 assert.throws(()=>C.addTransaction(a,transactions,{...x,toAmount:undefined}),/Conversión/);
 assert.throws(()=>C.addTransaction(accounts,transactions,{...x,toId:'mercado-pago',toAmount:1000}),/No se permite/);
});
test('no sumar cartera no verificada y convertir solo valoración explícita',()=>{
 const finances=C.overview(accounts,transactions,'2026-11');
 assert.equal(I.consolidate(finances,null,950).available,false);
 assert.throws(()=>I.consolidate(finances,{valueUSDMinor:20000,verified:false,asOf:'2026-11-19'},950),/verificada/);
 const result=I.consolidate(finances,{valueUSDMinor:20000,verified:true,asOf:'2026-11-19'},950);
 assert.equal(result.totalCLP,805011);assert.equal(result.investmentsCLP,190000);
});
test('respaldo autenticado por propietario: exportar, importar y verificar integridad',async()=>{
 const str=await B.exportBackup(C,{accounts,transactions},'demo-only');
 const imported=await B.importBackup(C,str,'demo-only');assert.deepEqual(imported,{accounts,transactions});
 await assert.rejects(()=>B.importBackup(C,str,'user-other'),/otra cuenta/);
 await assert.rejects(()=>B.importBackup(C,str.replace('650000','650001'),'demo-only'),/alterado|dañado/);
 await assert.rejects(()=>B.importBackup(C,'x'.repeat(B.MAX_BYTES+1),'demo-only'),/demasiado grande/);
});
test('exportación CSV identifica monedas y cantidad destino',()=>{
 const a=usd(),t=C.addTransaction(a,transactions,{id:'transfer-fx',date:'2026-11-12',type:'transfer',amount:9500,toAmount:1000,fromId:'bank-main',toId:'usd-bank',category:'',note:'cambio',source:'manual'});
 const csv=C.exportTransactionsCSV(a,t);assert.match(csv,/Moneda destino/);assert.match(csv,/USD/);assert.match(csv,/1000/);
});
