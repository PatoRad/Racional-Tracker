> Cliente con acceso privado por cuenta. Estado de adopción, verificaciones y límites: [revisión previa a publicación](docs/CIERRE_PRE_MAIN.md).

# Racional Tracker — Libro de Portafolio

Aplicación web estática para registrar aportes, compras, ventas, retiros, dividendos, comisiones, rebalanceos y rendimientos de un portafolio de inversiones, principalmente en USD. **No es una conexión automática con Racional ni una fuente de cotizaciones bursátiles en tiempo real.**

## Estado del proyecto

El cliente requiere una cuenta de Google con correo verificado y permiso administrativo `trackerAccess`. Cada cuenta autorizada accede únicamente a su portafolio. Firestore exige App Check además de las reglas privadas. La adopción inicial es para el propietario; habilitar nuevas cuentas requiere autorización administrativa.

La sesión real, las reglas, App Check, el guardado y la recuperación del respaldo fueron comprobados durante la adopción controlada. Las evidencias y pendientes están en [docs/ADOPCION_PRODUCCION.md](docs/ADOPCION_PRODUCCION.md). La publicación del frontend se revisa mediante PR y CI.

## Funcionalidades

- Registro, edición, filtrado y eliminación de movimientos.
- Conversión referencial CLP/USD con tipo de cambio ingresado manualmente.
- Valor estimado a partir de movimientos, rendimiento y comisiones, no de precios de mercado.
- Asignación objetivo para VOO, VXUS, VWO, XLE, GLDM y VNQ.
- Asignación estimada por **costo histórico remanente** cuando existen unidades registradas; no representa la valoración de mercado.
- Costo promedio, rendimiento simple y rentabilidad anualizada estimada (XIRR).
- Importación/exportación JSON y exportación XLSX.

## Arquitectura

`index.html` contiene la interfaz y los cálculos. `account-store.js` gestiona portafolios bajo `users/{uid}/portfolios/main` y movimientos individuales. Las escrituras son transacciones con revisión y comprobación de conflictos; la carga pagina de 500 en 500 y rechaza datos incompletos o que exceden el máximo. `app-config.js` contiene la configuración pública de App Check.

Los respaldos locales son versionados por proyecto y UID, con una generación anterior. La importación de otro propietario se rechaza; los respaldos antiguos requieren confirmación y validación. Se admiten hasta 400 cambios atómicos por operación, 10000 registros y archivos JSON de 2 MB. Las importaciones mayores necesitan un procedimiento de migración separado; no dividir un reemplazo en importaciones sucesivas.

Chart.js se usa para gráficos y SheetJS/XLSX para exportar Excel. Las páginas de diagnóstico se conservan para revisión, pero `_config.yml` las excluye del sitio GitHub Pages. La vista temporal de pruebas usa una lista de publicación independiente.

**Importante:** este repositorio utiliza **Firebase Firestore, no Supabase**. La configuración pública de Firebase forma parte del código cliente; las reglas Firestore, el control de acceso y cualquier autenticación de producción deben auditarse por separado. Las claves de configuración web no sustituyen a las reglas de autorización.

## Uso y ejecución local

1. Obtén una copia del repositorio.
2. Abre el sitio en un servidor estático local (por ejemplo, `python3 -m http.server 8000`) y visita `http://localhost:8000`.
3. **No introduzcas datos reales durante el desarrollo.** El cliente apunta al proyecto configurado; servirlo localmente no lo convierte en una demostración aislada. Google y App Check requieren dominios autorizados. Abrirlo como archivo `C:/...` no sirve para probar el acceso web.
4. Para desarrollar con persistencia, usa exclusivamente un proyecto Firebase de prueba o el emulador, con credenciales y reglas adecuadas.

## Ejecutar las pruebas

Necesitas Node.js >=24.12, npm y Java 21 para el emulador:

```bash
npm ci --ignore-scripts
npm test
npm run test:security
```

La suite de cliente simula Firebase, el almacenamiento y el navegador. La suite de seguridad utiliza el SDK real exclusivamente contra el emulador local con proyecto demo y aborta si no está en loopback:8088. CI también construye el sitio con Jekyll y verifica los archivos publicados y las exclusiones. Consulta [tests/README.md](tests/README.md).

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

- El documento legado compartido permanece bloqueado; no se migra ni se consulta automáticamente. La autorización se basa en Firebase Auth y claims administrativos, no en roles que el usuario pueda escribir en documentos.
- Las posiciones se aproximan por costo histórico; los activos «Otro» no están incluidos en la distribución objetivo.
- Los respaldos en `localStorage` no están cifrados y no sustituyen una copia externa. Exporta JSON y consérvalo en un lugar confiable. No hay historial inmutable ni se ha configurado respaldo administrado/PITR o protección de eliminación de la base.
- El XIRR utiliza la última fecha registrada como valoración terminal; hay que contrastarlo con datos representativos.
- Dependencias de CDN, especialmente XLSX 0.18.5, requieren revisión y actualización.
- Se comprobó un flujo real del propietario, pero no se declara auditoría exhaustiva de todos los dispositivos, cálculos o escenarios de producción. Los conflictos entre dos clientes se prueban en el emulador.
- No compartas respaldos, tokens ni credenciales privadas en el repositorio o en reportes. Las claves públicas de configuración no sustituyen las reglas de seguridad.

## Reglas de seguridad del proyecto

No ejecutar pruebas destructivas contra datos reales, no publicar credenciales privadas y no modificar `main` desde la rama de auditoría. Evaluar los cambios mediante un pull request y pruebas antes de desplegar.

> **Aviso:** las cifras son cálculos orientativos de un registro personal; no constituyen asesoría de inversión ni una conciliación certificada con el intermediario.


## Auditoría Firebase / Firestore (Etapa 3)

El historial de las ramas de auditoría está en [docs/FIREBASE_SECURITY_AUDIT.md](docs/FIREBASE_SECURITY_AUDIT.md). Las reglas privadas, el permiso del propietario y la exigencia de App Check se adoptaron posteriormente con autorizaciones expresas; véase [docs/ADOPCION_PRODUCCION.md](docs/ADOPCION_PRODUCCION.md). No publicar cambios de reglas ni configuraciones de producción sin revisión y autorización.
