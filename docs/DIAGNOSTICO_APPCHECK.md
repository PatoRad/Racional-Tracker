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
El MCP no expone la configuración del proveedor. Posteriormente se encontró
en el CLI instalado la interfaz experimental local `appcheckadmin` y se ejecutaron
solo comandos `get`: clave Enterprise idéntica al cliente, umbral 0.5 y TTL 1h.
Firestore y Authentication figuran `Unenforced`, con replay protection `Off`.
La bandera experimental solo habilitó comandos locales; no se usaron operaciones
de escritura. Las capturas del propietario muestran ambos dominios de reCAPTCHA.

El diagnóstico anterior filtraba solo códigos `auth/...`. Eso ocultaba los
errores del namespace `appCheck/...` que también pueden propagarse al popup.
Se añadió diagnóstico limitado de ambos namespaces, sin mostrar mensajes,
customData ni tokens. Las pruebas cubren esta propagación y la prueba separada.

No se ha demostrado que Google funcione ni que App Check emita tokens válidos.
No se cambiaron proveedores, umbrales, enforcement, reglas, datos ni main.
No activar proveedores debug, desactivar controles ni repetir solicitudes para
eludir el throttle. Primero corregir la causa y después validar con el propietario.

## Restricción de la clave de API encontrada

La lectura de metadatos mediante el cliente oficial del CLI confirmó que
`Browser key (auto created by Firebase)` solo permite el referrer
`patorad.github.io/*`. Las APIs App Check, Identity Toolkit y Secure Token
sí están incluidas. El origen del preview no está permitido en esa clave.
No se modificó la clave. Esta restricción es distinta de los dominios de
Authentication y reCAPTCHA, que ya se configuraron.

Además, la prueba enviaba `Referrer-Policy: no-referrer` tanto en Hosting como
en un meta HTML; esto impide presentar un origen para validar restricciones
HTTP de sitio web. Se corrigió a `strict-origin-when-cross-origin`: envía el
origen a otros sitios HTTPS sin enviar la ruta ni la consulta de la página.
Se conserva el control por dominio y no se amplían APIs.

Cambio autorizado expresamente por el propietario y aplicado el 6 de noviembre
de 2026 a las 02:18 (America/Santiago): preservar
`patorad.github.io/*` y agregar exclusivamente
`https://contabilidad-4f074--audit-acceso-sfey17m6.web.app/*` y
`https://contabilidad-4f074.firebaseapp.com/*` (origen del manejador de Google).
Se conservó toda la lista actual de restricciones de APIs. La operación utilizó
el etag como control de concurrencia, guardó los metadatos previos localmente
(sin credenciales) y verificó mediante lectura posterior que las restricciones
coinciden exactamente con la actualización autorizada. Tres pruebas locales
del procedimiento comprobaron preservación de otros sitios/APIs, idempotencia
y rechazo de proyecto/estado inesperados.

Después del cambio, la prueba de navegador en el dominio temporal mostró
«App Check entregó un token». No se mostró ni se copió el token y no se consultó
Firestore. Esto verifica emisión en esa sesión, no enforcement ni el acceso
del propietario a su portafolio. La sesión real con Google sigue pendiente.

El permiso del
dominio temporal debe retirarse después de cerrar la prueba, en un paso
autorizado. La caducidad de Hosting no elimina automáticamente estos permisos.
No se considera completa la adopción hasta verificar Google con el propietario,
su permiso privado y las condiciones restantes de producción. Main, reglas,
enforcement y movimientos no se modificaron en este paso.

## Cuenta del propietario

El propietario confirmó acceso con Google, proporcionó su UID y mostró que
App Check emitió un token en su navegador. Autorizó explícitamente conceder
`trackerAccess: true` exclusivamente a esa cuenta.

El 6 de noviembre de 2026 a las 02:25 (America/Santiago), mediante las funciones
del CLI oficial `findUser` y `setCustomClaim` con `merge: true`, se comprobó:
UID exacto, proveedor Google, correo verificado, cuenta habilitada y correo
coincidente con el de la sesión administrativa del CLI. No había otras claims.
La lectura posterior confirmó `trackerAccess: true`. Solo se consultó esa cuenta;
no se exportaron usuarios ni se consultó Firestore. No se publican UID ni correo
del propietario en esta evidencia del repositorio público.

Tres pruebas del procedimiento comprobaron preservación de claims, rechazo
de identidad/proveedor/estado incorrectos y rechazo de claims inválidas o
demasiado grandes. El token de la sesión del propietario necesita renovarse
antes de verificar el permiso desde el cliente. Las reglas siguen bloqueadas;
todavía no se adopta el esquema nuevo ni se considera completa la aplicación.
