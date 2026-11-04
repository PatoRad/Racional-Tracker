# Pruebas de regresión aisladas

Ejecutar con **Node.js 20+** desde la raíz:

```bash
node --test tests/regression.test.cjs
```

Los casos extraen el JavaScript del `index.html` y lo cargan con `node:vm`. Firebase/Firestore, localStorage, Chart.js y FileReader son simulados. No hay conexión ni modificaciones a la base real.

## Casos

- Inicialización en entorno ficticio.
- Escape HTML de descripciones.
- Signos negativos de rendimientos.
- Posición remanente de una venta parcial con ganancia.
- Escape HTML de la hora importada.
- Rechazo de una importación con monto inválido.
- Ponderaciones objetivo que suman 100%.

**Historial:** estas pruebas fueron incorporadas en la primera etapa, cuando cinco casos reproducían defectos. La rama de corrección modifica el código de la aplicación para superar los casos, pero la ejecución exacta de Node debe confirmarse en una máquina o CI. No hay un workflow automático publicado en esta etapa.

## Límites

No prueban reglas efectivas de Firestore, permisos, concurrentes, recuperación del respaldo, dependencias CDN, compatibilidad real de navegador ni valores de mercado. Se requiere un entorno de desarrollo o emulador Firebase para las pruebas de integración. Nunca probar con movimientos financieros reales.
