# Diagnóstico pendiente de App Check — 6 de noviembre de 2026

La captura del propietario confirma que Google no completa el acceso en el
dominio temporal. No hay identidad ni UID verificados todavía.

Se reprodujo en una sesión independiente del navegador la prueba separada
de App Check, sin iniciar sesión ni cargar Firestore. El SDK notificó HTTP 403,
`appCheck/initial-throttle` y después `appCheck/throttled`, con suspensión de
reintentos por 24 horas. Esto acredita el fallo de esa sesión de prueba;
no demuestra por sí solo que sea exactamente el mismo error del propietario.
Las sesiones automatizadas también pueden recibir puntuaciones diferentes.

Firebase MCP `firebase_get_sdk_config` confirmó que projectId, appId, apiKey y
authDomain coinciden con los del cliente. No se leyeron documentos financieros.
La integración disponible no expone una herramienta para leer la configuración
del proveedor Enterprise de App Check ni la configuración de la clave de
reCAPTCHA. Faltan contrastar clave registrada, dominios y umbral en consola.

El diagnóstico anterior filtraba solo códigos `auth/...`. Eso ocultaba los
errores del namespace `appCheck/...` que también pueden propagarse al popup.
Se añadió diagnóstico limitado de ambos namespaces, sin mostrar mensajes,
customData ni tokens. Las pruebas cubren esta propagación y la prueba separada.

No se ha demostrado que Google funcione ni que App Check emita tokens válidos.
No se cambiaron proveedores, umbrales, enforcement, reglas, datos ni main.
No activar proveedores debug, desactivar controles ni repetir solicitudes para
eludir el throttle. Primero corregir la causa y después validar con el propietario.
