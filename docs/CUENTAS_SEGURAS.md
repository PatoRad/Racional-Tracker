# Cuentas seguras: prototipo de adopción, NO desplegado

Decisión del propietario: primero uso personal con Google; después varias cuentas
con portafolios separados. Rama audit/cuentas-seguras, basada en 736537d, sin merge,
sin tocar main y sin leer o modificar información financiera real.

## Cambios y compatibilidad

- Google con correo verificado, custom claim administrativo trackerAccess=true y persistencia limitada a la pestaña/sesión. El cliente verifica el token antes de abrir un listener; las reglas comprueban la autorización emitida por Firebase.
- Un portafolio main bajo users/{uid}/portfolios/main. Este documento solo tiene
  schemaVersion=2 y revision. Los movimientos son documentos independientes en
  /movements/{id}, con esquema estricto; fecha se guarda como Timestamp a medianoche UTC.
- Cada escritura de movimientos debe avanzar revision en la misma transacción.
  El cliente compara revisión y contenido esperado de cada documento modificado.
  Esto rechaza también cambios administrativos que no hayan avanzado revisión.
- IDs y orden estables en editar/borrar; no se escribe el array completo.
- Cambio de cuenta: se vacían vista y formularios, se retira el listener anterior
  y se descartan respuestas o guardados en cola de la sesión anterior.
- Respaldos versionados por proyecto y UID, con generación anterior; no se
  recuperan automáticamente las antiguas claves compartidas del navegador.
- Una importación versionada de otro UID se rechaza. Los archivos de la versión
  antigua sin UID requieren confirmación y se destinan a la cuenta visible.
- Errores de almacenamiento permanecen visibles aunque la nube sincronice.
- Cambio máximo atómico: 400 movimientos por operación (más metadatos).
  Operaciones mayores se rechazan completas y conservan el borrador/JSON.
  No dividir a ciegas un reemplazo grande: preparar una migración por lotes revisada.
- Configuración pública app-config.js: requireAppCheck=true. Si falta una site key
  pública válida no se inicializa Firebase, no se inicia sesión ni se consulta nube.
  No contiene secretos y no admite omitir App Check en producción.
- package-lock.json fija también dependencias transitivas de herramientas de pruebas.
  Los SDK web siguen siendo dependencias de CDN; un fallo de carga bloquea la nube.

La versión nueva NO consulta /libro ni migra datos silenciosamente. Las reglas
nuevas deniegan esa ruta y no son compatibles con el cliente antiguo: no desplegar
ningún componente aislado.

## Revisión adversarial y comprobaciones

Las pruebas del cliente cubren cambios de sesión, respuestas tardías, cola de
guardados, corrupción, conflictos, respaldos, importación y cálculos anteriores.
Las pruebas del emulador intentan leer/listar/escribir/borrar datos ajenos,
usar sesiones anónimas o no verificadas, inyectar roles, borrar campos requeridos,
introducir tipos o fechas inválidos y escribir movimientos sin revisión atómica.
También ejecutan AccountStore contra el SDK/emulador real y simulan dos clientes.

Ejecutar:
  npm ci --ignore-scripts
  npm test
  npm run test:security

La prueba de seguridad aborta si FIRESTORE_EMULATOR_HOST no es localhost:8088 o
127.0.0.1:8088. Solo usa demo-racional-security-tests y datos sintéticos.
No ejecutar la app con credenciales o datos reales durante QA.

## Revisión básica de configuración de producción — 2026-11-06

Evidencia: capturas de consola proporcionadas por el propietario, sin consultar
documentos financieros ni probar acceso a ellos. Son observaciones de pantalla,
no una exportación autenticada del ruleset mediante API.

| Control | Evidencia observada |
| --- | --- |
| Firestore (default) | Versión superior seleccionada en historial: 2026-10-01 04:25 según consola. Ruta exacta del documento de libro con allow read, write: if true. |
| App Check, aplicación web | Libro de Contabilidad: sin registrar, sin proveedor. |
| App Check, Cloud Firestore | No se aplica. |
| Authentication | Pantalla de agregar el primer método: ningún proveedor habilitado. |
| Dominios autorizados | localhost, contabilidad-4f074.firebaseapp.com, contabilidad-4f074.web.app. |

Hallazgo crítico: las reglas mostradas autorizan leer, modificar y eliminar ese
documento sin sesión y App Check no se exige para Firestore. No se ha demostrado
ni descartado acceso previo de terceros. La autorización abierta corresponde a
esa ruta concreta; no se afirma lectura pública de cualquier colección.

Si se mantiene GitHub Pages, el acceso con Google necesitará autorizar el host
patorad.github.io. El dominio definitivo de despliegue aún debe confirmarse.
No se añadió ningún dominio ni se habilitó ningún proveedor.

La revisión básica de estos controles queda documentada. No equivale a una
auditoría exhaustiva de IAM, actividad histórica, otras bases o hosting.
El CLI/MCP continúa sin cuenta autenticada: tener una sesión en Edge no inicia
sesión en la integración. Su acceso no es necesario para interpretar las capturas,
pero sí para ejecutar verificaciones administrativas por API en otra fase.

Respaldo: el propietario confirmó el 2026-11-06 que conserva una copia externa.
El agente no recibió el JSON ni verificó su contenido, integridad o recuento.
Véase [ADOPCION_PRODUCCION.md](ADOPCION_PRODUCCION.md) para contención propuesta,
adopción y reversión. No se ha autorizado ni ejecutado ningún cambio de producción.

## Adopción futura: requiere intervención explícita

1. Completar auditoría de configuración con el propietario.
2. Revisar las reglas prototipo y aprobar un plan de adopción y reversión.
3. Habilitar Google/dominio y registrar App Check en un entorno de ensayo;
   configurar la site key pública; comprobar métricas y enforcement.
4. Autorizar inicialmente solo el UID del propietario con trackerAccess=true mediante un procedimiento administrativo aprobado por separado. No se asignó ningún claim real durante este trabajo. Posteriormente podrán autorizarse otros UID.
5. Probar OAuth y reCAPTCHA en navegador real; los dobles de prueba no validan
   esos servicios ni los permisos reales.
6. El propietario exporta su copia en la versión antigua y verifica su backup
   fuera de la app. El agente no necesita ver esos movimientos.
7. Verificar identidad destino, ensayar migración con datos sintéticos, aprobar
   por separado adopción coordinada de cliente y reglas.
8. Restaurar JSON en la cuenta correcta, comparar recuentos y totales, y probar
   recuperación y reversión antes de abrir el acceso a otras personas.

## Límites que siguen abiertos

- App Check del cliente no garantiza enforcement: se comprueba en consola.
- Google puede crear una cuenta de Authentication al iniciar sesión. La autorización trackerAccess bloquea los datos para cuentas no admitidas, pero no sustituye cuotas ni protección de altas de Authentication. No se ha configurado producción.
- No se implementa una cuota agregada segura por UID. Hay límites por documento y
  por operación; antes de publicar hacen falta cuotas, presupuesto y monitorización.
- Respaldos en localStorage sin cifrado; quien acceda al mismo perfil del navegador
  o ejecute código en ese origen puede leerlos. No son backup externo.
- No hay fusión automática de conflictos. Se conserva el borrador para exportar y
  reconciliar explícitamente. Las transacciones no operan sin conexión.
- No es una auditoría completa de las dependencias CDN o del hosting.
- Un administrador de Firebase puede eludir Security Rules; IAM queda fuera de
  la autorización de clientes. No se concedieron ni modificaron permisos.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for verified Google accounts with strict UID ownership, validated movement documents and atomic revision updates. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Fuentes oficiales:
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/security/rules-fields
- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
## Verificación registrada

Primera ejecución de esta rama, commit 523e608:
https://github.com/PatoRad/Racional-Tracker/actions/runs/42147079200
36/36 pruebas de cliente y 18/18 de reglas/integración, sin fallos ni omisiones.
Incluye cliente real en emulador y dos sesiones con estado desactualizado.
La revisión posterior añadió cobertura del ajuste automático y evitó lecturas
tardías de sesiones anteriores; esos cambios requieren la ejecución siguiente.

Prueba de navegador local: pantalla de acceso bloqueada correctamente al faltar
la site key, portafolio oculto, sin errores ni advertencias de consola.
No se inició Firebase ni se leyó el documento heredado en esa comprobación.
## Historial del acceso técnico por CLI/MCP

El servidor Firebase MCP 15.35.0 pudo iniciarse. Se invocó solamente la herramienta
firebase_get_environment, declarada de lectura. Resultado: Authenticated User:
<NONE>. El proyecto objetivo se fijó únicamente en una carpeta local de auditoría
ignorada por Git. El valor de billing devuelto sin sesión no acredita el estado
real de facturación y no se usa como hallazgo.

El propietario debe iniciar sesión en Firebase CLI con su cuenta habitual.
En una terminal con Node/npm disponibles:
  npx --yes firebase-tools@15.35.0 login --no-localhost

El usuario completa personalmente el acceso de Google. No debe pegar tokens,
códigos de autorización ni claves privadas en el chat. Después se puede consultar
el ruleset activo con firebase_get_security_rules, sin consultar documentos.
Para proveedores/dominios de Authentication y registro/enforcement de App Check,
usar acceso de lectura a configuración en consola/API: esas herramientas de
lectura no están expuestas por este servidor MCP.

No se aceptaron términos de Gemini, no se cambió IAM y no se creó ninguna cuenta
de Authentication ni se asignó trackerAccess en producción durante este trabajo.
Revisión adicional: se reprodujo con un test fallido un defecto al usar __proto__
como nombre de activo: calcCostoPromedio trataba propiedades heredadas como ETF
objetivo y podía alterar Object.prototype dentro de la aplicación. Se corrigió
usando una comprobación de propiedad propia, igual que en calcEtfReal.
El caso queda como regresión permanente con datos sintéticos.

## Resultado final verificado — 2026-11-05

Código probado: 23a188fc5e3de081d1c5b3dc052add063a414322.
Commits de implementación: 523e608 (cuentas y esquema), 252b81b (ajustes/lecturas),
d08a64b (admisión administrativa), 23a188f (propiedades heredadas de ETF).
Ejecución: https://github.com/PatoRad/Racional-Tracker/actions/runs/42149008513
Job 127667374681: success. Logs: 41/41 pruebas del cliente y 19/19 pruebas del
emulador/integración; cero fallos y cero omisiones. La suite del emulador incluye
el cliente con SDK real, aislamiento por UID, Google verificado, permiso emitido
por administrador, revisiones y rollback atómico.
También se ejecutó el emulador local con el proyecto demo tras completar la
instalación; se detuvo correctamente al terminar. El servidor HTTP de QA se cerró.
Main permanece en d22b3790188907481bfd7f5df8885689ee904e6f.

Estado de adopción: NO desplegado. La revisión básica de configuración real se completó después mediante capturas (véase la sección del 2026-11-06). Siguen pendientes la contención autorizada, el acceso técnico cuando corresponda, Google/dominio/App Check, ensayo y autorización del UID del propietario. Ni las pruebas ni el resultado de
get_environment prueban reglas o enforcement de producción.
