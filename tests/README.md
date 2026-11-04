# Pruebas de regresión (rama de auditoría)

Estas pruebas usan exclusivamente registros sintéticos. **No deben ejecutarse sobre la aplicación desplegada ni contra el proyecto Firebase real.**

## Ejecutar

Requiere Node.js 20 o superior y no requiere instalar paquetes:

```sh
node --test tests/regression.test.cjs
```

La suite extrae el JavaScript integrado en `index.html` y lo evalúa con `node:vm` en un entorno simulado. Firestore, almacenamiento local, gráficos, diálogo e importación de archivos están reemplazados por simuladores. No se leen cuentas ni movimientos reales.

## Estado inicial (RED)

La suite está diseñada para expresar el **comportamiento correcto esperado**, no para aprobar artificialmente el código existente.

| Caso | Esperado con el código actual |
| --- | --- |
| Inicialización aislada | PASS |
| Escape HTML de la descripción | PASS |
| Rendimiento negativo conserva signo | FAIL: `fmtU` usa `Math.abs` |
| Venta parcial rentable conserva posición abierta | FAIL: resta importes en lugar de valorar acciones |
| Hora importada no genera HTML activo | FAIL: la hora se concatena sin escape |
| JSON inválido no reemplaza registros | FAIL: solo valida que `records` sea un arreglo |
| Objetivos suman 100 % | FAIL: los porcentajes suman 99 % |

**Importante:** estos fallos son regresiones reproducibles conocidas; no son un error de la infraestructura de pruebas. No se incorpora un workflow de CI que bloquee entregas hasta que se hayan aplicado las correcciones.

## Alcance y límites

Estas pruebas no verifican las reglas efectivas de Firebase, la autenticación, la configuración del hosting, compatibilidad con navegadores, incidencias de dependencias externas ni concurrencia real entre clientes. Todo ello exige evaluaciones separadas en un proyecto de prueba o emulador y jamás contra la base de producción.

Mantener `main` sin cambios. El archivo `index.html` no se modifica en esta fase. No se crea ni fusiona un pull request.
