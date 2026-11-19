/* Contrato de persistencia local de ensayo. Un futuro adapter Firestore tendrá read/commit con la misma semántica. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinanceRepository = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function createMemoryRepository(core, initial) {
    if (!core || typeof core.validateLedger !== 'function') throw new Error('Motor financiero obligatorio');
    let state = clone(initial);
    core.validateLedger(state.accounts,state.transactions);
    let revision = 1;
    return Object.freeze({
      read() { return {revision, ...clone(state)}; },
      commit(next, expectedRevision) {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== revision) throw new Error('Conflicto: la versión ha cambiado');
        core.validateLedger(next.accounts,next.transactions);
        state=clone({accounts:next.accounts,transactions:next.transactions});
        revision++;
        return this.read();
      },
      reset() {state=clone(initial);core.validateLedger(state.accounts,state.transactions);revision++;return this.read();}
    });
  }
  return Object.freeze({createMemoryRepository});
});
