# Rebalanceador de aportes (solo simulación)
La implementación está aislada en `rebalanceador.js`, sin acceso a Firebase, red, almacenamiento ni operaciones bursátiles. Se integra como tarjeta de **simulación manual** en `index.html`.

## Entradas
- Objetivos actuales normalizados al 100%, sin cambiar los ETF ni sus pesos.
- Valores **actuales de mercado en USD** de cada ETF, ingresados por el usuario (se admite cero).
- Aporte mensual en CLP y tipo de cambio CLP/USD ingresados manualmente; la calculadora convierte a USD. Valor predeterminado del aporte: CLP 25.000.
- La entrada manual no se guarda en Firestore ni en localStorage y se pierde al recargar.

## Algoritmo
Para cada ETF con objetivo positivo, simula asignar **el 100%** del aporte a ese ETF. Elige el que minimiza la suma de desviaciones cuadráticas en puntos porcentuales al objetivo del **portafolio completo después del aporte**. En empate, respeta el orden de los objetivos. La simulación no vende, no divide aportes, no escribe movimientos y no representa ejecución ni recomendación personalizada de inversión.

## Limitaciones
No confundir costos históricos de compra con valores de mercado. La aplicación aún no tiene una fuente fiable de cotizaciones y por eso **exige introducir las valoraciones actuales manualmente**; los importes de compra históricos no se usan como sustituto. La simulación considera solo los ETF objetivo, no cash/activos `OTRO`, comisiones, spreads, impuestos ni precios intradía. La conversión CLP/USD es referencial. No tomar decisiones de compra sin verificar valores y condiciones reales.

## Pruebas aisladas
```sh
node --test tests/rebalanceador.test.cjs tests/regression.test.cjs
```
Los tests de cálculo son completamente sintéticos y no requieren conectar Firebase. Los tests de regresión existentes utilizan mocks.
No desplegar cambios de Firebase ni fusionar con main sin revisión adicional.
