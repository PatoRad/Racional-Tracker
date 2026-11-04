# Racional Tracker — Libro de Portafolio

Aplicación web estática para registrar aportes, compras, ventas, retiros, dividendos, comisiones, rebalanceos y rendimientos de un portafolio de inversiones, principalmente en USD. **No es una conexión automática con Racional ni una fuente de cotizaciones bursátiles en tiempo real.**

## Estado del proyecto

La rama `main` conserva la versión publicada/original. En `audit/seguridad-y-calculos` se están corrigiendo errores y creando pruebas con datos sintéticos. **Esta rama no se debe desplegar ni fusionar a producción sin revisión de seguridad de Firebase y pruebas completas.**

## Funcionalidades

- Registro, edición, filtrado y eliminación de movimientos.
- Conversión referencial CLP/USD con tipo de cambio ingresado manualmente.
- Valor estimado a partir de movimientos, rendimiento y comisiones, no de precios de mercado.
- Asignación objetivo para VOO, VXUS, VWO, XLE, GLDM y VNQ.
- Asignación estimada por **costo histórico remanente** cuando existen unidades registradas; no representa la valoración de mercado.
- Costo promedio, rendimiento simple y rentabilidad anualizada estimada (XIRR).
- Importación/exportación JSON y exportación XLSX.

## Arquitectura

`index.html` contiene HTML, estilos y JavaScript cliente. Usa Chart.js para gráficos, SheetJS/XLSX para exportar archivos y Firebase Firestore (SDK compat) para sincronizar el arreglo completo de movimientos en un documento fijo. La aplicación mantiene una copia en `localStorage` pero **no dispone todavía de una recuperación de respaldo completa y verificada**.

**Importante:** este repositorio utiliza **Firebase Firestore, no Supabase**. La configuración pública de Firebase forma parte del código cliente; las reglas Firestore, el control de acceso y cualquier autenticación de producción deben auditarse por separado. Las claves de configuración web no sustituyen a las reglas de autorización.

## Uso y ejecución local

1. Obtén una copia del repositorio.
2. Abre el sitio en un servidor estático local (por ejemplo, `python3 -m http.server 8000`) y visita `http://localhost:8000`.
3. **No introduzcas datos reales durante el desarrollo.** Abrir `index.html` ejecuta su cliente Firebase configurado: el archivo no ofrece por sí solo un modo de demostración aislado.
4. Para desarrollar con persistencia, usa exclusivamente un proyecto Firebase de prueba o el emulador, con credenciales y reglas adecuadas.

## Ejecutar las pruebas

Necesitas Node.js 20 o superior, sin instalar dependencias:

```bash
node --test tests/regression.test.cjs
```

La suite simula Firebase, el almacenamiento y el navegador; no debe contactar los servicios reales. Consulta [tests/README.md](tests/README.md).

## Correcciones en la rama de auditoría

- Muestra el signo negativo del rendimiento acumulado.
- Escapa fecha, hora y tipo al construir la tabla.
- Rechaza importaciones JSON con datos inválidos, importaciones de más de 10.000 movimientos o archivos de más de 2 MB (cuando el navegador informa su tamaño).
- Aplica validación a los movimientos nuevos y editados.
- Conserva el costo histórico remanente de posiciones parcialmente vendidas cuando hay unidades registradas.
- Normaliza la distribución objetivo original del 99% al 100% **proporcionalmente**, sin cambiar las proporciones relativas introducidas.
- Utiliza la fecha local al iniciar el formulario.
- Espera el resultado del guardado antes de anunciar una importación como exitosa.

## Limitaciones y riesgos pendientes

- No se han comprobado las reglas de seguridad ni los permisos reales de Firebase. El documento único compartido y la escritura de `records` completo pueden ocasionar conflictos entre sesiones.
- Las posiciones se aproximan por costo histórico; los activos «Otro» no están incluidos en la distribución objetivo.
- La recuperación automática de `localStorage`, un historial inmutable de operaciones y el control de concurrencia siguen pendientes.
- El XIRR utiliza la última fecha registrada como valoración terminal; hay que contrastarlo con datos representativos.
- Dependencias de CDN, especialmente XLSX 0.18.5, requieren revisión y actualización.
- No se han ejecutado pruebas de navegador end-to-end ni una auditoría de despliegue.
- No se incorporaron pruebas de integración contra Firebase real: deben diseñarse con el emulador.

## Reglas de seguridad del proyecto

No ejecutar pruebas destructivas contra datos reales, no publicar credenciales privadas y no modificar `main` desde la rama de auditoría. Evaluar los cambios mediante un pull request y pruebas antes de desplegar.

> **Aviso:** las cifras son cálculos orientativos de un registro personal; no constituyen asesoría de inversión ni una conciliación certificada con el intermediario.
