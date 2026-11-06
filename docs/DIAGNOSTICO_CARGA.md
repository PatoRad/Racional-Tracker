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
concreto del navegador del propietario sigue sin identificarse hasta obtener
el código de la carga real. No se declara resuelto ni se recomienda importar.
