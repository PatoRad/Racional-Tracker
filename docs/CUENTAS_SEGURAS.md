# Cuentas seguras: prototipo de adopción, NO desplegado

Decisión del propietario: primero uso personal con Google; después varias cuentas
con portafolios separados. Rama audit/cuentas-seguras, basada en 736537d, sin merge,
sin tocar main y sin leer o modificar información financiera real.

## Cambios y compatibilidad

- Google con correo verificado y persistencia limitada a la pestaña/sesión.
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

## Auditoría de producción: evidencia que falta

Para cerrar este pendiente se requiere una sesión autorizada de lectura del
proyecto contabilidad-4f074 y recoger únicamente configuración:
1. Release y ruleset de Firestore activos, con fecha/identificador de versión.
2. Proveedores habilitados de Authentication, dominios autorizados y políticas.
3. App Check: registro de la aplicación web, proveedor, site key pública y
   enforcement real para Firestore (y Authentication si se usa ese producto).

Las herramientas del plugin instalado no expusieron esas lecturas en esta sesión.
Instalar el plugin no equivale a iniciar sesión o a tener permisos.
Nunca solicitar contraseñas, tokens, service-account JSON o backups financieros
para esta auditoría. No probar exposición leyendo un documento real.

## Adopción futura: requiere intervención explícita

1. Completar auditoría de configuración con el propietario.
2. Revisar las reglas prototipo y aprobar un plan de adopción y reversión.
3. Habilitar Google/dominio y registrar App Check en un entorno de ensayo;
   configurar la site key pública; comprobar métricas y enforcement.
4. Probar OAuth y reCAPTCHA en navegador real; los dobles de prueba no validan
   esos servicios ni los permisos reales.
5. El propietario exporta su copia en la versión antigua y verifica su backup
   fuera de la app. El agente no necesita ver esos movimientos.
6. Verificar identidad destino, ensayar migración con datos sintéticos, aprobar
   por separado adopción coordinada de cliente y reglas.
7. Restaurar JSON en la cuenta correcta, comparar recuentos y totales, y probar
   recuperación y reversión antes de abrir el acceso a otras personas.

## Límites que siguen abiertos

- App Check del cliente no garantiza enforcement: se comprueba en consola.
- Google por sí solo no restringe altas a una única persona. Para una beta cerrada
  se necesita política adicional de admisión; no se ha configurado producción.
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