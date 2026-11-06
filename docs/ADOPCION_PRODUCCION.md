# Adopción de producción — propuesta del 2026-11-06

Estado actualizado: contención publicada por el propietario según confirmación y captura. Adopción del cliente nuevo y reglas v2 NO desplegada. Rama audit/cuentas-seguras.
La confirmación de respaldo del propietario no revoca la prohibición original
de modificar main, hacer merge, desplegar o cambiar reglas/datos reales.

## Situación y decisión inmediata

Las capturas muestran una regla abierta sobre el documento usado por el cliente,
sin App Check aplicado y sin proveedores Auth habilitados. Mantener esa regla
durante una preparación prolongada mantiene el acceso no autenticado.

Se propone una contención separada de la migración: cambiar únicamente la
condición de esa autorización de true a false. Impide leer/escribir/eliminar el
documento desde clientes. No borra ni mueve datos. La app actual perderá la
sincronización y, después de recargar, no podrá cargar su portafolio de la nube.

### Resultado concreto para aprobar: contención

Este es el ruleset equivalente al observado, con la única condición cambiada.
Antes de usarlo, comparar con la consola vigente; si hay otras reglas o cambios,
detenerse y volver a revisar. NO publicar automáticamente.

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

Requisito previo: el propietario conserva su exportación externa y comprueba
localmente que el archivo JSON se abre, contiene records y corresponde al
portafolio esperado. No enviar movimientos al agente. Confirmación recibida:
respaldo conservado; contenido/recuento no examinados por el agente.

La contención requiere autorización específica porque cambia producción y causa
una interrupción temporal. No implica autorizar Google, App Check, claims,
publicación del cliente, migración ni merge. Si no se autoriza, no ejecutarla.

## Preparación de la versión nueva

1. Ensayar con un proyecto separado y datos sintéticos. Probar reglas y cliente
   juntos, Google con correo verificado y claim trackerAccess=true.
2. Definir el host definitivo y autorizar solo ese dominio OAuth. Para GitHub
   Pages sería patorad.github.io; no añadir rutas, protocolo o puerto.
3. Registrar el proveedor App Check para la app web y configurar la site key
   pública en app-config.js. Probar OAuth/reCAPTCHA reales en ensayo. Esta
   configuración y el enforcement de consola son controles diferentes.
4. Preparar admisión administrativa del UID personal. Los clientes no pueden
   asignarse trackerAccess. La concesión real exige aprobación por separado.
5. Preparar una publicación de la rama sin modificar main (por ejemplo, hosting
   de ensayo separado). La app nueva no debe depender de recuperar /libro.
6. Repetir las comprobaciones necesarias si cambia código/configuración. El
   código 23a188f ya tiene 41 pruebas de cliente y 19 de emulador en verde:
   https://github.com/PatoRad/Racional-Tracker/actions/runs/42149008513

## Corte y migración: otra autorización

No iniciar esta fase hasta que el ensayo esté verificado y se aprueben las
acciones concretas: reglas v2, Google/dominio, App Check, claim, publicación e
importación de datos. No basta con aprobar la contención.

Orden previsto: preparar configuraciones sin abrir el documento heredado;
publicar reglas v2 y cliente coordinadamente; habilitar la cuenta propietaria;
el propietario inicia sesión y verifica identidad antes de importar su JSON.
No reabrir /libro para facilitar la migración.

El propietario compara localmente recuentos y totales, prueba recuperación y
mantiene ambas copias externas. Si el reemplazo implica más de 400 cambios, parar:
el cliente rechaza la operación completa. Dividir archivos e importarlos como
reemplazos sucesivos eliminaría movimientos de lotes anteriores. Se necesita
una herramienta de migración por lotes diseñada y ensayada por separado.

## Reversión y condiciones de parada

- Si la app nueva falla, mantener los datos privados y detener nuevas escrituras.
  Conservar el JSON externo y exportar cualquier borrador recuperable.
- Volver al código anterior no autoriza restaurar allow ... if true. La app
  anterior puede permanecer fuera de servicio mientras se repara la versión segura.
- No borrar el documento antiguo ni los movimientos nuevos durante esta adopción.
- Parar ante cuenta destino incorrecta, datos inválidos, diferencias de recuento,
  conflictos, fallo de backup, límites de 400 cambios o configuración no verificada.
- No afirmar que no hubo accesos previos: las capturas no aportan historial de uso.

## Verificación de esta preparación

Solo se actualizaron archivos Markdown. No cambia código, reglas ejecutables,
configuración desplegable ni tests. Los resultados de 41+19 pruebas corresponden
al código ya comprobado; no se repiten suites por una edición documental.


## Avance confirmado por el propietario — 2026-11-06

- Contención: el propietario confirmó publicar if false en la ruta heredada.
  La captura conserva la ruta y estructura del ruleset. No se probó acceso al
  documento ni se consultaron movimientos para verificar la propagación.
- Google: captura de Authentication con proveedor Habilitada.
- Dominio patorad.github.io: incorporación confirmada por el propietario.
- App Check: captura de Libro de Contabilidad Registrada con Fraud Defense
  (reCAPTCHA Enterprise). TTL configurado de 1 hora.
- Site key pública entregada por texto e incorporada a app-config.js en
  77d7e8e50bb7f9188a59029069750cde8685fdc3, manteniendo requireAppCheck=true.
  Diff verificado: solo ese archivo de configuración y comentarios.
- El CLI oficial confirmó el 6 de noviembre que Firestore y Authentication tienen App Check Unenforced. No se ha autorizado activarlo todavía.
- Cuenta personal con trackerAccess: concedido el 6 de noviembre de 2026 con autorización expresa; identidad Google, correo verificado y coincidencia con el administrador del CLI comprobados. Lectura administrativa posterior confirmó el permiso. La captura posterior del propietario muestra «Cuenta autorizada para Racional Tracker» y «App Check entregó un token» en la sesión renovada.
- Cliente nuevo: publicado solo en canal temporal autorizado; main sin cambios por este trabajo.

Verificaciones del cambio de clave:
sintaxis JavaScript, valor exacto de la clave y configuración inmutable;
41/41 tests de cliente y 19/19 de emulador/integración sin fallos ni omisiones:
https://github.com/PatoRad/Racional-Tracker/actions/runs/42159190202
Esto NO verifica el proveedor real: los tests usan claves e identidades ficticias.

Reglas v2 publicadas con autorización expresa del propietario el 6 de noviembre
de 2026 a las 02:33 (America/Santiago), sin merge a main. Prerrequisitos de Google,
permiso privado y emisión de App Check confirmados por captura del propietario.
La suite local de reglas
se repitió con éxito: 19 aprobadas, cero fallos y cero omitidas, en proyecto demo
y emulador localhost:8088. Archivo propuesto SHA256:
489d04716682497205d5d03955415101a4cf4358388f8ad44f08cc9d16af678f.
Firebase MCP confirmó mediante lectura posterior que el contenido publicado
coincide exactamente con el archivo aprobado (normalizando únicamente saltos
de línea y espacios finales). Copia local de las reglas previas, que deniegan
el documento legado: `.tools/adoption/production-before.rules`. La publicación
aisló la configuración a Firestore (default), sin índices ni otros servicios.
No se consultaron documentos ni se migraron o escribieron movimientos.

El propietario confirmó que abrió el portafolio nuevo. Autorizó y ejecutó la
prueba sintética; su captura confirmó creación, lectura, edición y eliminación
verificadas (`success: true`, `cleaned: true`, sin error). Suite ampliada:
58 tests de cliente y 20 de emulador, también aprobados en CI del commit 485fb1b.

El propietario realizó la importación del respaldo tras revisar la confirmación:
0 registros en destino y 220 en el archivo, dentro de los 400 cambios permitidos.
Se normalizó exclusivamente el formato de dos fechas legadas válidas, con aviso
previo y sin alterar el archivo original. Confirmó que todo seguía disponible
después de recargar la página. El agente no leyó el respaldo ni consultó los
movimientos o sus valores; la persistencia real es evidencia del propietario.
Última suite del candidato da9f2e1: 72 tests de cliente y 22 de emulador aprobados
en CI (run 42174120286).

El propietario autorizó exigir App Check exclusivamente en Firestore. Se ejecutó
el comando oficial `appcheck:services:set firestore enforced`, sin parámetro de
replay ni cambios a Authentication. Lectura posterior verificada:
Firestore `Enforced`, replay `Off`, updateTime 2026-11-06T06:30:08.927903Z;
Authentication `Unenforced`, replay `Off`, updateTime anterior sin cambios.
Se realizó a las 03:30 America/Santiago; puede tardar hasta 15 minutos en
propagarse (03:45). No se consultaron ni modificaron movimientos en este paso.

El propietario confirmó acceso con los 220 movimientos y CRUD sintético con
éxito/limpieza después de propagación, a las 03:49 del 6 de noviembre de 2026.
No se consultaron sus movimientos desde herramientas del agente. La evidencia
del cliente positivo no sustituye una prueba negativa independiente con usuario
válido y token de App Check ausente; la configuración Enforced sí fue verificada.
Siguiente fase: revisión final y publicación del cliente en main/Pages.
Mantener el respaldo original y
exportar una copia versionada desde el cliente nuevo por acción del propietario.
El documento heredado permanece cerrado por la regla de denegación general.

Reversión segura: si falla la adopción, restaurar únicamente la copia previa
de denegación tras autorización. Nunca restaurar el antiguo `if true`.

Metadatos observados en lectura antes de publicar: protección contra eliminación
de la base y recuperación a un punto en el tiempo deshabilitadas. No se cambiaron.
Esto no acredita respaldo administrado; se mantiene como riesgo pendiente de
evaluación separada de costos y requisitos, además del JSON externo del propietario.
