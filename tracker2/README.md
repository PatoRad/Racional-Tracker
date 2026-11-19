# Racional Tracker 2.0 — Base de desarrollo aislada

**Rama:** `feature/tracker-2-finanzas-preview`. No hay cambios en `main`, ni conexión con Firestore de producción. Esta carpeta es una demo con datos ficticios, independiente del `index.html` actual del portafolio. La rama contiene código de persistencia de ensayo y reglas que **no deben desplegarse** en producción.

## Probar el prototipo

Extrae el ZIP y abre `index.html`, o ejecuta `python -m http.server 8000` dentro de la carpeta. El panel lateral muestra Inicio, Cuentas, Estadísticas, Reportes, Ahorros e Inversiones. Registra compras, ingresos, transferencias y rendimientos de ejemplo, crea cuentas CLP o USD, edita movimientos y compara estadísticas. Exporta CSV desde Reportes y un respaldo JSON desde Configuración; puedes volver a importarlo tras recargar. Los datos no se transmiten a ningún servidor ni se conservan automáticamente al cerrar.

En cuentas USD, los importes se ingresan en dólares con hasta dos decimales y se guardan como centavos. En cuentas CLP, se guardan pesos enteros. Si envías entre monedas distintas, debes ingresar cuánto salió y cuánto llegó. No se mezclan pesos y dólares en un total hasta definir explícitamente un tipo de cambio. Los datos de inversiones y el cambio utilizados en el módulo de integración son ficticios.

## Capas desarrolladas

| Archivo | Función |
|---|---|
| `finance-core.js` | Validaciones, movimientos, saldos por moneda, transferencias, estadísticas y CSV sin red |
| `finance-backup.js` | JSON versionado con checksum SHA-256 y comprobación de propietario |
| `finance-investments.js` | Consolidación **solo lectura** de una valoración explícita, fechada y verificada |
| `finance-firestore.js` | Adaptador para Firestore compat inyectable con lecturas paginadas, verificación de revisión, conflictos y escritura atómica |
| `firestore.staging.rules` | Propuesta de reglas privadas para **emulador** o entorno de ensayo |
| `firebase.demo.json` | Configuración emulador de Firestore en `localhost:8089` |

El cliente de demostración **no carga Firebase SDK** y su CSP define `connect-src 'none'`. El adaptador Firestore no se importa ni se inicializa desde esta página. Una eventual integración real requiere acceso autenticado, autorización administrativa, proyecto Firebase separado de ensayo, pruebas E2E y revisión explícita de reglas antes de publicar. La protección App Check debe verificarse aparte en el proyecto de ensayo, porque el emulador no demuestra enforcement real.

## Pruebas locales

```bash
node --test tests/*.test.cjs # excepto finance-rules.test.cjs, que necesita emulador
python tests/ui_smoke.py # Playwright, Chromium instalado
```

Para ejecutar las pruebas del emulador desde la raíz del repositorio (con dependencias instaladas desde package-lock del proyecto actual):

```bash
npm ci --ignore-scripts
npx firebase emulators:exec --config tracker2/firebase.demo.json --project demo-tracker2 --only firestore "node --test tracker2/tests/finance-rules.test.cjs && node --test tracker2/tests/finance-integration.test.cjs"
```

Si necesitas ejecutar todos los tests unitarios sin emulador: `node --test tracker2/tests/finance-core.test.cjs tracker2/tests/finance-extended.test.cjs tracker2/tests/finance-firestore.test.cjs tracker2/tests/finance-repository.test.cjs`.

## Medidas y riesgos pendientes

- **No hay sincronización de datos personales reales** en esta versión; la interfaz usa un repositorio de memoria y respaldos manuales. El Firestore adapter está preparado, pero aún no conectado al inicio de sesión del usuario.
- Los respaldos JSON detectan errores accidentales mediante checksum; **no están cifrados ni autenticados criptográficamente** frente a manipulación deliberada. Se recomienda guardarlos fuera de carpetas compartidas.
- La conservación cifrada de credenciales bancarias y el diseño de integración bancaria real son proyectos posteriores. No se debe conectar a bancos con credenciales guardadas en el navegador.
- La valuación real del portafolio exige una fuente coherente con fecha y criterio de valoración. Actualmente el portafolio de inversión original estima costo histórico y rendimiento, no cotizaciones actuales.
- Se necesita validar el esquema de Firestore y el control de revisión con emulador, probar reglas de acceso, importaciones masivas, recuperación de desconexiones, auditoría de seguridad y accesibilidad final antes de cualquier producción.
- No desplegar `firestore.staging.rules` ni modificar las reglas ya publicadas a partir de este prototipo: los rulesets de ensayo no preservan automáticamente todas las rutas del portafolio existente.

## Candidato de acceso privado (sin publicación)
Se añadió `finanzas.html` para una futura integración con Google Auth, App Check y el adaptador Firestore. A diferencia de `index.html` (demo sin red), esta pantalla debe probarse en un hosting autorizado y con reglas combinadas. `finance-session.js` valida la cuenta y descarta respuestas tardías tras cerrar sesión. La pantalla bloquea escrituras cuando no hay acceso confirmado y el botón de inversiones enlaza al módulo actual sin duplicar datos.

Las reglas de producción vigentes **no** se han sustituido. `firestore.production-candidate.rules` es solo una propuesta que conserva el portafolio y agrega Finanzas. `_config.yml` sigue excluyendo todo `tracker2` de GitHub Pages. El despliegue de Firebase y el acceso real con App Check siguen pendientes y requieren verificaciones fuera del emulador.
