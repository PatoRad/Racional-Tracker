# Prueba de acceso previa a main

## Evidencia del 6 de noviembre de 2026

El propietario completó el inicio de sesión del CLI mediante callback local.
Firebase MCP confirmó en lectura el proyecto `contabilidad-4f074` (Contabilidad,
741866902877) y las reglas publicadas:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /libro/9552cfc4c080106a828d392d3a08510b {
      allow read, write: if false;
    }
  }
}
```

Esto verifica la regla publicada; no se consultaron documentos ni movimientos.
No prueba una solicitud real de un cliente ni afecta accesos administrativos con IAM.
Google habilitado, dominio patorad.github.io y registro de App Check proceden
de capturas/confirmaciones del propietario, todavía sin prueba integrada del cliente.

## Artefacto preparado, sin publicar

`node prepare-preview.cjs` genera `.tools/preview/public` a partir de una lista
cerrada de cinco archivos públicos. No copia respaldos, credenciales, herramientas,
dependencias, logs ni datos. Genera un manifiesto SHA-256 y configuración separada
de Hosting. No conecta a Firebase ni publica nada. Si encuentra archivos extra,
se detiene para que se inspeccionen.

`verificar-acceso.html` carga exclusivamente SDK de App, Auth y App Check;
no carga Firestore ni AccountStore. Permite iniciar sesión de Google y comprobar
la obtención de un token de App Check sin mostrar tokens. Muestra el correo/UID
propios y si la cuenta posee el permiso `trackerAccess`. Iniciar sesión puede
crear una cuenta de Authentication; no otorga ese permiso.

La configuración propone el sitio `contabilidad-4f074`, pendiente de confirmar
que Hosting exista. Una futura publicación debe limitarse al canal
`audit-acceso`, con expiración de un día, usando `hosting:channel:deploy`,
`--expires 1d`, `--no-authorized-domains`, `--project contabilidad-4f074`
y `--config .tools/preview/firebase.json`. Requiere autorización expresa antes
de ejecutarse. El CLI puede requerir habilitar la API de Hosting si aún no existe;
no habilitar facturación ni crear recursos adicionales sin revisarlo.

El canal es una URL pública temporal y utiliza el mismo backend Firebase;
no es un proyecto de pruebas separado. La URL exacta necesita autorización en
Authentication y en la clave Enterprise. Actualmente solo se confirmó
`patorad.github.io` para la clave. No agregar dominios automáticamente.

## Condiciones restantes antes de main

1. Publicar y autorizar el dominio temporal con consentimiento del propietario.
2. Comprobar Google y App Check en navegador; verificar UID del propietario.
3. Otorgar `trackerAccess` solo a ese UID mediante un paso administrativo revisado,
   preservando otras claims. Todavía no se ha hecho.
4. Adoptar las reglas nuevas y verificar aislamiento por cuenta según el plan
   de producción. El documento legado continúa bloqueado.
5. Comprobar alta/edición/sincronización usando datos sintéticos acordados y
   comprobar App Check antes de exigirlo. No confundir registro con enforcement.
6. Recuperar el respaldo por acción del propietario, validar sus totales y
   revisar el límite de 400 cambios antes de una importación grande.
7. Revisar CI y acordar el merge/publicación final. Main sigue sin modificarse.

Pruebas locales de cliente: 46 aprobadas, incluyendo cinco de diagnóstico
(configuración ausente, token oculto, errores sin secretos, cierre de sesión
durante verificación y fallo de popup). Las pruebas no acreditan OAuth ni
reCAPTCHA en producción. La última suite de reglas de la rama aprobó 19 casos
contra emulador; no se cambiaron reglas en este paso.
