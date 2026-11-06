# Prueba sintética autorizada

El propietario autorizó una prueba temporal de creación, lectura, edición y
eliminación de un movimiento ficticio en su portafolio nuevo. No autoriza
consultar otros movimientos, importar respaldos ni usar credenciales administrativas
para eludir reglas. La prueba de producción aún no se ha ejecutado al preparar
este documento; debe usar la sesión real de Google del propietario.

`probar-guardado.html` y `storage-probe.js` implementan el flujo aislado:

- Exigen Google verificado, trackerAccess y token de App Check antes de iniciar.
- Generan un ID UUID con prefijo `qa_`; no aceptan un ID de movimiento ordinario.
- Leen solo el contador de revisión y el documento recién generado.
- Rechazan colisiones sin sobrescribir ni borrar el registro existente.
- Crean un aporte marcado PRUEBA TEMPORAL con monto ficticio 1; comprueban su
  lectura desde servidor; lo editan a 2 y comprueban de nuevo.
- Intentan eliminarlo incluso si falla la edición. Antes de borrar, comprueban
  todos los campos del registro para evitar eliminar contenido modificado.
- Comprueban desde servidor que desapareció. Si la limpieza no se confirma,
  muestran el ID y conservan una referencia por UID en sessionStorage para
  reintentar. No cierran ni borran automáticamente una prueba incierta.
- Cada escritura avanza atómicamente la revisión del portafolio. Esa revisión
  permanece después de borrar el registro, como requiere el protocolo.

No editar/importar movimientos desde otra pestaña mientras se ejecuta la prueba.
La prueba modifica exclusivamente su registro y los metadatos de revisión;
no restaura ni sobrescribe otros movimientos ni lee la colección completa.
Los clientes que estén observando el portafolio pueden ver el registro temporal.

Validación previa: 58 tests locales de cliente y 20 de reglas/integración contra
emulador demo aprobados. Se incluyeron colisión, error de edición, rechazo de
limpieza de contenido distinto y comprobación de que no se leen otros registros.
La integración usa el mismo módulo con el SDK real y las reglas aprobadas.
Esto no sustituye la ejecución con la cuenta real del propietario.
