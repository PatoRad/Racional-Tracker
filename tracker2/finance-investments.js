/* Puente de lectura solamente. Rechaza valoraciones no confirmadas. Ninguna escritura al portafolio. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceInvestments=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function consolidate(finance,valuation,fx){
 if(!finance?.byCurrency?.CLP||!finance?.byCurrency?.USD)throw Error('Resumen financiero inválido');
 if(!valuation)return {available:false,reason:'Sin valoración confiable de inversiones',cashCLP:finance.byCurrency.CLP.assets,cashUSDMinor:finance.byCurrency.USD.assets};
 if(valuation.verified!==true||!Number.isSafeInteger(valuation.valueUSDMinor)||valuation.valueUSDMinor<0||!/^\d{4}-\d{2}-\d{2}$/.test(valuation.asOf||''))throw Error('Se requiere una valoración verificada y fechada');
 if(!Number.isFinite(fx)||fx<=0||fx>1e6)throw Error('Tipo de cambio inválido');
 const cashCLP=finance.byCurrency.CLP.assets,usdMinor=finance.byCurrency.USD.assets;
 const cashUSDClp=Math.round(usdMinor*fx/100);
 const investmentsCLP=Math.round(valuation.valueUSDMinor*fx/100);
 const total=cashCLP+cashUSDClp+investmentsCLP;
 if(!Number.isSafeInteger(total))throw Error('Patrimonio excede precisión segura');
 return {available:true,asOf:valuation.asOf,fx,cashCLP,cashUSDMinor:usdMinor,investmentsUSDMinor:valuation.valueUSDMinor,investmentsCLP,totalCLP:total,estimated:true};
}
return Object.freeze({consolidate});
});
