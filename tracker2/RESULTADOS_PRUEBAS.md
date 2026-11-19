# Racional Tracker 2.0 — Resultados de ensayo (19 de noviembre de 2026)

## Verificado localmente con datos ficticios

- 24/24 pruebas de motor financiero, respaldos, integridad, conversiones, conflictos y persistencia simulada aprobadas (Node.js 22.16.0).
- Pruebas de navegador en Chromium mediante Playwright: escritorio y móvil correctos, sin errores de JavaScript.
- Comprobadas: navegación lateral, transferencias, doble conteo, cuentas CLP/USD, campos de cambio de divisas, edición, eliminación, escape HTML y exportación CSV.
- Respaldos JSON: creación, importación correcta, rechazo de otro propietario y rechazo de checksum modificado (prueba unitaria); interfaz de importación/exportación disponible, no ensayada en navegador confiable por las restricciones del navegador de pruebas.
- Firestore: adaptador probado con una simulación de SDK, revisión optimista y escritura atómica; no probado contra Firebase remoto ni emulador real en este entorno.

## No verificado / no habilitado

- Pruebas de reglas Firestore con emulador real (`tests/finance-rules.test.cjs`, requiere dependencia + emulador) y enforcement App Check real.
- Autenticación Google y sincronización desde la interfaz, validación entre dos equipos y recuperación de sesiones reales.
- Restauración de datos personales reales, importaciones bancarias en producción o valoraciones del portafolio en vivo.
- Cotizaciones de USD o de ETF en tiempo real: sólo supuestos explícitos de demostración.

**Política:** no modificar `main`, ni Firestore real, ni datos de inversión. El cliente demo tiene CSP `connect-src 'none'`.
