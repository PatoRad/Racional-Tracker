/* Rebalanceador puro: no Firebase, red, almacenamiento ni órdenes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RacionalRebalanceador = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function calcularRebalanceo({ objetivos, valoresUSD, aporteUSD }) {
    if (!objetivos || !valoresUSD || typeof objetivos !== 'object' || typeof valoresUSD !== 'object') throw new TypeError('Se requieren objetivos y valores USD');
    const etfs = Object.keys(objetivos);
    if (!etfs.length || etfs.some(e => !/^[A-Z0-9.]{1,12}$/.test(e))) throw new RangeError('Lista de ETF inválida');
    const sumaObjetivos = etfs.reduce((s, e) => {
      const w = objetivos[e];
      if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) throw new RangeError('Objetivo inválido: ' + e);
      return s + w;
    }, 0);
    if (Math.abs(sumaObjetivos - 100) > 1e-6) throw new RangeError('Los objetivos deben sumar 100%');
    if (Object.keys(valoresUSD).length !== etfs.length || Object.keys(valoresUSD).some(e => !Object.prototype.hasOwnProperty.call(objetivos, e))) throw new RangeError('Faltan o sobran valores de ETF');
    for (const e of etfs) if (typeof valoresUSD[e] !== 'number' || !Number.isFinite(valoresUSD[e]) || valoresUSD[e] < 0) throw new RangeError('Valor de mercado inválido: ' + e);
    if (typeof aporteUSD !== 'number' || !Number.isFinite(aporteUSD) || aporteUSD <= 0) throw new RangeError('El aporte debe ser positivo');
    const totalAntes = etfs.reduce((s, e) => s + valoresUSD[e], 0);
    const totalDespues = totalAntes + aporteUSD;
    const candidatos = etfs.filter(e => objetivos[e] > 0).map(etf => {
      const porcentajes = {};
      let error = 0;
      for (const e of etfs) {
        const pct = (valoresUSD[e] + (e === etf ? aporteUSD : 0)) / totalDespues * 100;
        porcentajes[e] = pct;
        error += Math.pow(pct - objetivos[e], 2);
      }
      return { etf, error, porcentajes };
    }).sort((a,b) => a.error - b.error || etfs.indexOf(a.etf) - etfs.indexOf(b.etf));
    if (!candidatos.length) throw new RangeError('Sin ETF elegibles');
    const elegido = candidatos[0];
    const porcentajesAntes = Object.fromEntries(etfs.map(e => [e, totalAntes ? valoresUSD[e] / totalAntes * 100 : 0]));
    return {
      etf: elegido.etf,
      aporteUSD,
      totalAntesUSD: totalAntes,
      totalDespuesUSD: totalDespues,
      porcentajesAntes,
      porcentajesDespues: elegido.porcentajes,
      desviacionAntesPP: totalAntes ? porcentajesAntes[elegido.etf] - objetivos[elegido.etf] : null,
      desviacionDespuesPP: elegido.porcentajes[elegido.etf] - objetivos[elegido.etf],
      errorCuadraticoDespues: elegido.error
    };
  }
  return Object.freeze({ calcularRebalanceo });
});
