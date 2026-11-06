# Revisión previa a publicar el cliente

El 6 de noviembre de 2026 a las 03:49 (America/Santiago), después de la ventana
de propagación de App Check (activado a las 03:30), el propietario confirmó ambas
comprobaciones: aplicación sincronizada con 220 movimientos y prueba sintética
con éxito y limpieza. El agente no consultó movimientos ni recibió sus valores.

## Controles completados

- Google y correo verificado, permiso administrativo solo para la cuenta revisada.
- Reglas privadas por UID publicadas con autorización y contenido verificado.
- Documento legado cerrado, sin restaurar permisos públicos.
- App Check de Firestore Enforced, con Auth y replay sin cambios.
- CRUD sintético real con eliminación confirmada, antes y después de enforcement.
- Respaldo de 220 registros importado por el propietario; persistencia tras recargar.
- Correcciones de carga paginada y formatos de fecha legados, sin omitir registros.
- 72 pruebas de cliente y 22 de emulador aprobadas en el candidato da9f2e1 y CI
  posterior del head 20445ed. No prueban por sí solas todos los estados posibles.

## Publicación de GitHub Pages

Main sigue en d22b3790188907481bfd7f5df8885689ee904e6f. Su último workflow exitoso
`pages build and deployment` usa `Build with Jekyll` y después despliega Pages.
Actualizar main puede publicar automáticamente el cliente. No se cambió el modo
de Pages ni se publicó el cliente definitivo durante esta preparación.

Se añadió `_config.yml` para excluir documentación, tests y páginas/herramientas
de diagnóstico del sitio definitivo. Siguen en el repositorio público para
revisión; no contienen respaldos ni credenciales privadas. El canal temporal usa
una lista de archivos independiente y conserva las páginas de prueba.
La nueva tarea CI `sitio` construye con la acción oficial de Jekyll y comprueba
que HTML/JS de la aplicación se conservan y que QA/desarrollo quedan excluidos.
No contiene pasos de despliegue ni permisos de escritura. Debe aprobarse junto
con `pruebas` antes del merge.

## Límites y mantenimiento posterior

- Mantener el JSON original y exportar una copia versionada del cliente nuevo
  por acción del propietario; no enviarla al agente ni subirla al repositorio.
- LocalStorage almacena respaldos sin cifrado; requiere un navegador y equipo
  confiables. No equivale a un respaldo externo o administrado.
- PITR y protección de eliminación de la base no están activados. Evaluarlos
  aparte con sus requisitos/costos, sin habilitar facturación automáticamente.
- No se declara validación independiente de cifras ni de dos dispositivos reales.
  Los conflictos entre dos clientes se prueban en el emulador.
- Las dependencias CDN conservan sus versiones revisadas; no se afirma una
  auditoría exhaustiva de toda la cadena de suministro.
- El alta pública de nuevos usuarios no está habilitada para datos: falta el
  claim administrativo. La apertura a terceros requiere otra fase de preparación.
- Después del paso al dominio definitivo y su verificación, retirar únicamente
  los permisos del dominio temporal de Auth/reCAPTCHA/clave API, con autorización;
  la caducidad de Hosting no los retira por sí sola.
- Mantener las reglas privadas en una reversión del frontend; no reabrir el
  documento legado. Una reversión adicional de seguridad requiere revisión.
