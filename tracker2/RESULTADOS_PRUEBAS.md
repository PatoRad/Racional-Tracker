# Racional Tracker 2.0 — Resultados de ensayo (19 de noviembre de 2026)

## Verificado localmente con datos ficticios

- 24/24 pruebas de motor financiero, respaldos, integridad, conversiones, conflictos y persistencia simulada aprobadas (Node.js 22.16.0).
- Pruebas de navegador en Chromium mediante Playwright: escritorio y móvil correctos, sin errores de JavaScript.
- Comprobadas: navegación lateral, transferencias, doble conteo, cuentas CLP/USD, campos de cambio de divisas, edición, eliminación, escape HTML y exportación CSV.
- Respaldos JSON: creación, importación correcta, rechazo de otro propietario y rechazo de checksum modificado (prueba unitaria); interfaz de importación/exportación disponible, no ensayada en navegador confiable por las restricciones del navegador de pruebas.
- Firestore: adaptador probado con una simulación de SDK. Reglas de seguridad y adaptador con SDK real probados mediante GitHub Actions en el emulador del proyecto `demo-tracker2` (ejecución 44491736824): 3 pruebas de reglas y 1 prueba de integración, todas aprobadas.

## No verificado / no habilitado

- App Check en un entorno real (el emulador no garantiza enforcement), el ciclo de autenticación/desautenticación del navegador y la conexión al frontend siguen pendientes de pruebas independientes.
- Autenticación Google y sincronización desde la interfaz, validación entre dos equipos y recuperación de sesiones reales.
- Restauración de datos personales reales, importaciones bancarias en producción o valoraciones del portafolio en vivo.
- Cotizaciones de USD o de ETF en tiempo real: sólo supuestos explícitos de demostración.

**Política:** no modificar `main`, ni Firestore real, ni datos de inversión. El cliente demo tiene CSP `connect-src 'none'`.
## Validaciones adicionales
- 30 pruebas unitarias del motor y control de sesión aprobadas localmente con Node 22.
- Nuevo caso: lectura de Firestore retrasada tras cerrar sesión no muestra información privada.
- Suite de reglas **combinadas** agregada al workflow para validar la coexistencia con el portafolio.
- Pendientes de verificación: navegador completo con sesión Google y App Check reales, reglas de producción y recuperación sobre dominio autorizado.
