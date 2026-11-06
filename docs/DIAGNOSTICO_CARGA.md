# Carga pendiente antes de importar

Tras la prueba sintética exitosa, el propietario mostró en la aplicación completa
«No se pudo verificar la nube» y, al intentar importar, «Espera a que cargue tu
portafolio antes de editar». No se seleccionó ni importó el respaldo.

El éxito del CRUD aislado no demuestra la carga de una colección del cliente
completo. Se añadió diagnóstico estático por etapa: metadatos, consulta,
revisión, validación o pantalla; se muestran solo códigos conocidos del SDK o
del validador. Nunca se muestran mensajes crudos, documentos, tokens o IDs.
No se relajan permisos ni validación y se conserva el bloqueo de importación.

La regresión de recargar un portafolio con metadatos existentes y cero
movimientos después del CRUD sintético pasó con el SDK real y las reglas en
el emulador. Suite: 60 tests locales y 21 de emulador aprobados. El problema
concreto se investigó posteriormente con el código de la carga real.

## Causa confirmada y corrección

La captura del propietario identificó `consulta: invalid-argument`. Se confirmó
mediante lectura de metadatos que la base es STANDARD / FIRESTORE_NATIVE.
La consulta del cliente pedía 10001 documentos en un único target de escucha,
usado por el SDK web para obtener la consulta desde servidor.

La página temporal `verificar-limite.html` contrastó dos consultas anónimas
contra una colección ficticia ajena a los movimientos, denegada por las reglas:
10001 produjo `invalid-argument` y la frase de máximo 10000; 500 produjo
`permission-denied`, sin el rechazo de límite. No se leyeron documentos ni se
escribió ningún registro. Esto reproduce el rechazo del backend web sin consultar
datos financieros. El emulador y Query Explain sin ejecución habían aceptado el
plan 10001; no bastaban para verificar el target de escucha de producción.

Se sustituyó la carga única por páginas de 500 con cursor DocumentSnapshot.
Se conserva la revisión posterior de metadatos, el descarte de respuestas de
sesiones o cargas anteriores y la protección de borradores. Una lectura final
de hasta un documento detecta exceso del máximo de 10000: se rechaza completo
en vez de presentar una lista truncada o permitir borrados basados en ella.

Verificaciones ampliadas: 63 tests locales y 22 de emulador aprobados. Incluyen
501 registros con el SDK real y cursores, exactamente 10000 y rechazo de 10001
sin sustituir la vista anterior. Cada consulta está limitada a 500. No se
modificaron reglas, índices ni datos reales. La corrección se publicó solo en
el canal temporal autorizado. Falta confirmación del propietario de que la
aplicación muestra «Sincronizado»; no recomendar importar antes de comprobarlo.
