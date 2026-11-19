const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../finance-core.js');
const {createMemoryRepository}=require('../finance-repository.js');
test('la persistencia de ensayo usa control optimista de revisiones',()=>{
 const repo=createMemoryRepository(core,core.demoData());const first=repo.read();
 const updated=core.addTransaction(first.accounts,first.transactions,{id:'tx-new',date:'2026-11-12',type:'expense',amount:400,accountId:'bank-main',category:'Otros gastos',note:'Ejemplo',source:'manual'});
 const second=repo.commit({accounts:first.accounts,transactions:updated},first.revision);
 assert.equal(second.revision,first.revision+1);
 assert.throws(()=>repo.commit({accounts:first.accounts,transactions:updated},first.revision),/Conflicto/);
 assert.equal(repo.read().transactions.length,5);
});
test('leer devuelve copias inmutables respecto al estado interno',()=>{
 const repo=createMemoryRepository(core,core.demoData());const state=repo.read();state.transactions[0].amount=1;state.accounts[0].name='hack';
 assert.equal(repo.read().transactions[0].amount,650000);assert.equal(repo.read().accounts[0].name,'Cuenta bancaria');
});
test('restablecer revierte únicamente la demostración y avanza revisión',()=>{
 const repo=createMemoryRepository(core,core.demoData());const r1=repo.read();const r2=repo.reset();assert.equal(r2.revision,r1.revision+1);assert.equal(core.overview(r2.accounts,r2.transactions,'2026-11').assets,615011);
});
