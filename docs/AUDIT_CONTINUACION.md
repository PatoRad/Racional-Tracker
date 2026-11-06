# Continuación de auditoría — 2026-11-05

Estado: cambios en audit/sincronizacion-respaldo-seguro, desde
1516cc7cb6477f4570441ff465a037207b8645e9 (audit/firebase-firestore-seguridad),
que incorpora audit/seguridad-y-calculos (1f3eca0).
No se modificó main, no se hizo merge ni despliegue. No se consultaron documentos,
movimientos, usuarios de Authentication ni credenciales privadas.

## Correcciones del cliente

- Reemplazo de set incondicional por transacción que compara records con la última
  versión de servidor aceptada. Los reintentos de Firestore conservan la misma
  precondición: un cambio ajeno provoca rechazo, no una sobrescritura.
- Captura independiente y cola de guardados. Se conservan otros campos del documento
  mediante merge. No se guardan cambios en nube antes de recibir estado de servidor.
- Snapshots de caché o escrituras pendientes no se presentan como sincronizados.
  Snapshots remotos no reemplazan ediciones locales pendientes o recuperadas.
- Error/conflicto bloquea nuevos intentos en esa sesión y conserva la vista local.
  Exportar JSON, recargar para obtener servidor e importar la copia elegida es el
  procedimiento manual. No existe fusión automática de movimientos.
- Respaldos locales actual y anterior recuperables en la vista con confirmación y
  validación. Recuperar no escribe en nube. El listener inicial ya no destruye el
  respaldo del navegador. Importación fallida conserva contenido visible/exportable.
- Si falla localStorage, se informa aunque el guardado en nube tenga éxito.
  La importación que reemplaza una vista no vacía exige respaldo local disponible.

Los respaldos permanecen en texto claro en localStorage y dependen del mismo
navegador/origen. No son backup externo, cifrado ni garantía ante borrado del perfil.
El esquema sigue siendo un documento compartido: esto NO implementa autorización
ni evita clientes antiguos o maliciosos que escriban directamente sin transacción.
La comparación de JSON puede producir conflictos conservadores por orden de campos.

## Pruebas

Base: 8/8 regresiones pasaban antes de cambios.
Cliente corregido: 19/19 pruebas Node con Firebase, DOM y almacenamiento simulados,
sin omisiones. Incluyen conflicto, cola, fallo de nube, recuperación, cuota y datos
remotos inválidos. No equivalen a una prueba de navegador o producción.

Suite Firestore importada de fix/firestore-security-validation, blob
1eaa5c1a3d590dddc190afe34215f82980203026: falla si faltan dependencias,
solo acepta localhost/127.0.0.1:8088 y proyecto demo. Crédito al trabajo de
Completa seguridad Firestore, commits da4ea2d y f83137b.
Evidencia previa: https://github.com/PatoRad/Racional-Tracker/actions/runs/42139532367
(14 pruebas Firestore y 21 sintéticas en esa otra rama).
Esto no acredita automáticamente los cambios de cliente de esta rama.

## Auditoría de reglas propuestas (no desplegadas)

La propuesta niega libro y rutas desconocidas, restringe portfolios al UID de
Firebase Auth, comprueba claves y longitud de lista tanto en create como update,
y niega delete. No usa ownerId/role controlados por cliente para autorizar.
No valida los elementos de records; permite corrupción de datos propios, objetos
arbitrarios y carga hasta el límite documental. La cuenta puede crear múltiples
portfolios: no hay cuota por usuario ni control de volumen agregado.
No se encontró escalada entre UIDs en la propuesta; esto no demuestra seguridad real.
El cliente sigue sin Authentication/App Check y usa libro, por lo que esas reglas
lo bloquearían. No desplegar sin migración, respaldo y reversión.

## Pendientes que requieren acceso o decisión del propietario

1. Sesión administrativa de solo lectura de contabilidad-4f074 para leer release
   y ruleset desplegados; proveedores habilitados, dominios autorizados y políticas
   de Authentication; registro/proveedor/enforcement de App Check para Firestore.
   No listar documentos ni usuarios para estas verificaciones.
2. Definir identidad propietaria y acceso compartido antes de implementar sesión,
   rutas por UID y migración del documento heredado.
3. Diseñar esquema que valide cada movimiento en servidor (preferiblemente
   documentos individuales), cuotas y límites de consumo.
4. Probar navegador y emulador con cliente migrado y datos exclusivamente sintéticos.
5. Aprobar una futura adopción por separado: este trabajo no autoriza cambios reales.

Referencias oficiales:
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/app-check/enable-enforcement
## Entorno y límites de acceso de esta sesión

Firebase está instalado y ENABLED según el administrador de plugins. Su manifiesto
arranca firebase-tools MCP con npx. Esta sesión no expuso sus herramientas.
Se intentó iniciar el mismo servidor mediante un transporte MCP restringido a
get_environment, list_projects y get_security_rules; la instalación local quedó
incompleta (MODULE_NOT_FOUND: ini), sin obtener configuración real. No se hizo
ninguna llamada a documentos o usuarios para comprobar exposición.

La revisión del código del servidor MCP 15.35.0 confirmó que get_security_rules
lee releases/rulesets y requiere proyecto y sesión autenticada. Sus herramientas
Auth son get_users/update_user/set_sms_region_policy; no se invocaron. No hay
herramienta de lectura de proveedores/dominios Auth o enforcement App Check.
Se requiere acceso administrativo adicional de solo lectura para completar esos
controles; instalar el plugin no demuestra una sesión autenticada.

El workflow de esta rama instala versiones directas exactas con Node 24 y Java 21,
y ejecuta tanto regresión como emulador demo. Las dependencias transitivas aún no
tienen lockfile; queda pendiente fijarlas para reproducibilidad completa.