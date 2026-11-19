/* Racional Tracker 2.0: motor financiero puro, sin acceso a red ni Firebase. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinanceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = ['income','expense','transfer','yield'];
  const ACCOUNT_TYPES = ['checking','cash','wallet','savings'];
  const CURRENCIES = ['CLP','USD']; // CLP = pesos, USD = centavos; todos los montos son enteros seguros.
  function formatMinor(amount,currency='CLP') {
    invariant(Number.isSafeInteger(amount) && CURRENCIES.includes(currency),'Monto o moneda inválidos');
    return new Intl.NumberFormat('es-CL',{style:'currency',currency,minimumFractionDigits:currency==='USD'?2:0,maximumFractionDigits:currency==='USD'?2:0}).format(currency==='USD'?amount/100:amount);
  }
  function parseMinor(value,currency='CLP'){
    invariant(CURRENCIES.includes(currency),'Moneda inválida');
    const s=String(value).trim();
    invariant(currency==='CLP'?/^\d{1,13}$/.test(s):/^\d{1,11}(?:\.\d{1,2})?$/.test(s),'Monto inválido: usa pesos enteros o dólares con hasta 2 decimales');
    const n=currency==='CLP'?Number(s):(()=>{const [whole,cents='']=s.split('.');return Number(whole)*100+Number(cents.padEnd(2,'0'));})();
    invariant(isAmount(n,true),'Monto fuera de rango');return n;
  }
  const CATEGORY = {
    income: ['Sueldo','Trabajo independiente','Reembolso','Otros ingresos'],
    expense: ['Alimentación','Transporte','Servicios','Vivienda','Salud','Educación','Entretenimiento','Compras','Otros gastos'],
    yield: ['Intereses','Otros rendimientos']
  };
  function invariant(condition, message) { if (!condition) throw new Error(message); }
  function validId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(id); }
  function validateDate(date) {
    invariant(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date), 'Fecha inválida');
    const [y,m,d] = date.split('-').map(Number);
    const dateUTC = new Date(Date.UTC(y,m-1,d));
    invariant(y>=2000 && y<=2100 && dateUTC.getUTCFullYear() === y && dateUTC.getUTCMonth() === m-1 && dateUTC.getUTCDate() === d, 'Fecha inexistente');
    return date;
  }
  function isAmount(n, allowZero=false) { return Number.isSafeInteger(n) && n>= (allowZero ? 0 : 1) && n<=1_000_000_000_000; }
  function validText(s, limit=200) { return typeof s==='string' && s.length<=limit && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s); }
  function validateAccount(a) {
    invariant(a && validId(a.id), 'ID de cuenta inválido');
    invariant(validText(a.name,60) && a.name.trim().length>0, 'Nombre de cuenta inválido');
    invariant(ACCOUNT_TYPES.includes(a.type), 'Tipo de cuenta inválido');
    invariant(CURRENCIES.includes(a.currency), 'La cuenta debe estar en CLP o USD');
    invariant(isAmount(a.openingBalance,true), 'Saldo inicial inválido');
    return a;
  }
  function validateTransaction(tx, accounts) {
    invariant(tx && validId(tx.id), 'ID de movimiento inválido');
    invariant(TYPES.includes(tx.type), 'Tipo de movimiento inválido');
    invariant(isAmount(tx.amount), 'El monto debe ser un entero positivo en CLP');
    validateDate(tx.date);
    invariant(validText(tx.note), 'Descripción inválida');
    invariant(validText(tx.category,60), 'Categoría inválida');
    invariant(['manual','demo','bank_import','bank_api'].includes(tx.source), 'Origen de movimiento inválido');
    if(tx.source==='bank_import' || tx.source==='bank_api') {
      invariant(typeof tx.provider==='string' && /^[a-z0-9._-]{2,60}$/i.test(tx.provider), 'Proveedor bancario inválido');
      invariant(typeof tx.externalId==='string' && tx.externalId.trim().length>0 && tx.externalId.length<=160, 'Referencia bancaria obligatoria');
    }
    const lookup = id => accounts.find(a=>a.id===id);
    if (tx.type === 'transfer') {
      const from=lookup(tx.fromId),to=lookup(tx.toId);
      invariant(from && to, 'Las cuentas de transferencia deben existir');
      invariant(tx.fromId !== tx.toId, 'Las cuentas deben ser distintas');
      if(from.currency!==to.currency) invariant(isAmount(tx.toAmount), 'Conversión: debes indicar el monto recibido en la otra moneda');
      else invariant(tx.toAmount === undefined, 'No se permite monto convertido en transferencias de la misma moneda');
    } else {
      invariant(lookup(tx.accountId), 'Cuenta inexistente');
      invariant(tx.toAmount === undefined, 'Monto destino no corresponde al movimiento');
      invariant(typeof tx.category==='string' && tx.category.trim().length>0, 'Categoría requerida');
    }
    return tx;
  }
  function validateLedger(accounts, transactions) {
    invariant(Array.isArray(accounts) && Array.isArray(transactions), 'Libro inválido');
    invariant(accounts.length<=100 && transactions.length<=20000, 'Límite del prototipo excedido');
    const accountIds=new Set(), transactionIds=new Set(), externalKeys=new Set();
    for(const a of accounts) {validateAccount(a);invariant(!accountIds.has(a.id),'ID de cuenta duplicado'); accountIds.add(a.id);}
    for(const tx of transactions) {
      validateTransaction(tx,accounts);invariant(!transactionIds.has(tx.id),'ID de movimiento duplicado');transactionIds.add(tx.id);
      if(tx.source==='bank_import'||tx.source==='bank_api') {
        const key=JSON.stringify([tx.provider.toLowerCase(),tx.externalId]);
        invariant(!externalKeys.has(key),'Movimiento bancario duplicado');externalKeys.add(key);
      }
    }
    return true;
  }
  function calculateBalances(accounts, transactions) {
    validateLedger(accounts,transactions);
    const balances=Object.fromEntries(accounts.map(a=>[a.id,a.openingBalance]));
    for(const tx of transactions) {
      if(tx.type==='transfer'){balances[tx.fromId]-=tx.amount;balances[tx.toId]+=tx.toAmount??tx.amount;}
      else balances[tx.accountId]+=(tx.type==='expense'?-tx.amount:tx.amount);
    }
    invariant(Object.values(balances).every(Number.isSafeInteger),'Saldo supera el límite seguro');
    return balances;
  }
  function periodSummary(accounts, transactions, month, currency='CLP') {
    invariant(typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Mes inválido');
    invariant(CURRENCIES.includes(currency),'Moneda inválida');
    validateLedger(accounts,transactions);
    const byId=Object.fromEntries(accounts.map(a=>[a.id,a]));
    const items=transactions.filter(tx=>tx.date.startsWith(month));
    const totals={income:0,expense:0,yield:0,transfer:0};
    const categories=Object.create(null);
    for(const tx of items){
      const txCurrency=tx.type==='transfer'?byId[tx.fromId].currency:byId[tx.accountId].currency;
      if(txCurrency!==currency)continue;
      totals[tx.type]+=tx.amount;
      if(tx.type==='expense')categories[tx.category]=(categories[tx.category]||0)+tx.amount;
    }
    invariant(Object.values(totals).every(Number.isSafeInteger),'Totales exceden límite seguro');
    return {...totals,net:totals.income+totals.yield-totals.expense,categories,count:items.length,currency};
  }
  function overview(accounts, transactions, month, fxClpPerUsd=null) {
    const balances=calculateBalances(accounts,transactions), totals=periodSummary(accounts,transactions,month);
    const byCurrency={CLP:{available:0,savings:0,assets:0},USD:{available:0,savings:0,assets:0}};
    for(const a of accounts) {const group=byCurrency[a.currency];if(a.type==='savings')group.savings+=balances[a.id];else group.available+=balances[a.id];}
    for(const group of Object.values(byCurrency)) {group.assets=group.available+group.savings;invariant(Object.values(group).every(Number.isSafeInteger),'Saldo por moneda no seguro');}
    const clp=byCurrency.CLP,usd=byCurrency.USD;
    let consolidatedCLP=null;
    if(fxClpPerUsd!==null){
      invariant(Number.isFinite(fxClpPerUsd)&&fxClpPerUsd>0&&fxClpPerUsd<=1_000_000,'Tipo de cambio inválido');
      consolidatedCLP=clp.assets+Math.round(usd.assets*fxClpPerUsd/100);
      invariant(Number.isSafeInteger(consolidatedCLP),'Valor convertido no seguro');
    }
    return {balances,available:clp.available,savings:clp.savings,assets:clp.assets,byCurrency,consolidatedCLP,...totals};
  }
  function monthSeries(accounts,transactions,month,count=6) {
    invariant(Number.isInteger(count) && count>=1 && count<=24,'Cantidad de meses inválida');
    periodSummary(accounts,transactions,month);
    const [year,mo]=month.split('-').map(Number);
    return Array.from({length:count},(_,i)=>{
      const dt=new Date(Date.UTC(year,mo-1-(count-1-i),1));
      const key=dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0');
      return {month:key,...periodSummary(accounts,transactions,key)};
    });
  }
  function addTransaction(accounts,transactions,tx) {
    validateLedger(accounts,transactions); validateTransaction(tx,accounts);
    invariant(!transactions.some(t=>t.id===tx.id),'Movimiento duplicado');
    const next=transactions.concat({...tx});validateLedger(accounts,next);return next;
  }
  function updateTransaction(accounts,transactions,tx) {
    validateLedger(accounts,transactions); validateTransaction(tx,accounts);
    invariant(transactions.some(t=>t.id===tx.id),'Movimiento inexistente');
    const next=transactions.map(t=>t.id===tx.id?{...tx}:t);validateLedger(accounts,next);return next;
  }
  function deleteTransaction(accounts,transactions,id) {
    validateLedger(accounts,transactions);invariant(transactions.some(t=>t.id===id),'Movimiento inexistente');
    return transactions.filter(t=>t.id!==id);
  }
  function addAccount(accounts,transactions,account) {
    validateLedger(accounts,transactions);validateAccount(account);
    invariant(!accounts.some(a=>a.id===account.id),'Cuenta duplicada');
    const next=accounts.concat({...account});validateLedger(next,transactions);return next;
  }
  function escapeCSVCell(value) {
    let s=String(value??'');
    // La comilla simple impide que Excel ejecute fórmulas inyectadas en descripciones.
    if (/^[\s]*[=+@\-\t\r]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function exportTransactionsCSV(accounts,transactions) {
    validateLedger(accounts,transactions);
    const byId=Object.fromEntries(accounts.map(a=>[a.id,a]));
    const header=['Fecha','Tipo','Monto origen (unidad mínima)','Moneda origen','Cuenta','Monto destino (unidad mínima)','Moneda destino','Cuenta destino','Categoría','Descripción','Origen'];
    const rows=transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(t=>[
      t.date,t.type,t.amount,(t.type==='transfer'?byId[t.fromId]:byId[t.accountId]).currency,
      t.type==='transfer'?byId[t.fromId].name:byId[t.accountId].name,
      t.type==='transfer'?(t.toAmount??t.amount):'',t.type==='transfer'?byId[t.toId].currency:'',t.type==='transfer'?byId[t.toId].name:'',t.category,t.note,t.source
    ]);
    return '\uFEFF'+[header,...rows].map(r=>r.map(escapeCSVCell).join(';')).join('\r\n');
  }
  function demoData() {
    const accounts=[
      {id:'bank-main',name:'Cuenta bancaria',type:'checking',currency:'CLP',openingBalance:0},
      {id:'mercado-pago',name:'Mercado Pago',type:'savings',currency:'CLP',openingBalance:0}
    ];
    const transactions=[
      {id:'demo-salary',date:'2026-11-03',type:'income',amount:650000,accountId:'bank-main',category:'Sueldo',note:'Ingreso de ejemplo',source:'demo'},
      {id:'demo-transfer',date:'2026-11-05',type:'transfer',amount:100000,fromId:'bank-main',toId:'mercado-pago',category:'',note:'Ahorro mensual',source:'demo'},
      {id:'demo-grocery',date:'2026-11-08',type:'expense',amount:35000,accountId:'bank-main',category:'Alimentación',note:'Compra de supermercado',source:'demo'},
      {id:'demo-yield',date:'2026-11-10',type:'yield',amount:11,accountId:'mercado-pago',category:'Intereses',note:'Ganancia acreditada (ejemplo)',source:'demo'}
    ];
    validateLedger(accounts,transactions);
    return {accounts,transactions};
  }
  return Object.freeze({TYPES,ACCOUNT_TYPES,CURRENCIES,CATEGORY,formatMinor,parseMinor,validateAccount,validateTransaction,validateLedger,calculateBalances,periodSummary,overview,monthSeries,addAccount,addTransaction,updateTransaction,deleteTransaction,exportTransactionsCSV,demoData});
});
