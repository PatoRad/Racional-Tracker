> Informe histórico de la rama anterior. El modelo actual y sus límites están documentados en [CUENTAS_SEGURAS.md](CUENTAS_SEGURAS.md).

# Auditoría de seguridad de Firebase / Firestore — Etapa 3

**Estado: propuesta NO desplegada.** Fecha: 2026-11-04. Rama: `audit/firebase-firestore-seguridad`.

## Alcance confirmado por el repositorio

- `index.html` incluye configuración pública del cliente Firebase y la SDK compat.
- Inicializa Firestore y lee/escribe un único documento fijo de `libro` mediante `onSnapshot` y `set({records})`.
- No implementa Firebase Authentication, selección de usuario ni aislamiento por propietario.
- La configuración real de las reglas de la base, el estado de App Check, los métodos de autenticación habilitados y los controles del hosting **no están disponibles** en los archivos examinados.
- No se inspeccionó ningún documento, usuario, credencial privada ni movimiento real. No se usaron accesos a la API de Firestore de producción.

**Conclusión:** un documento conocido y un SDK en el navegador no demuestran por sí mismos lectura/escritura pública. La exposición depende de las reglas **efectivamente desplegadas**, que no han sido verificadas. Una API key web de Firebase es normalmente pública y no debe tratarse como una contraseña.

## Material preparado

- `firestore.rules`: **modelo propuesto**, que deniega `/libro/{documentId}` y permite solo al propietario autenticado leer/crear/actualizar un portafolio en `/users/{uid}/portfolios/{portfolioId}`; niega el resto y los borrados.
- `firebase.json`: emulador Firestore local, puerto 8088, sin interfaz web.
- `tests/firestore-security.test.cjs`: casos de autorización que usan únicamente identidades y documentos ficticios.

Estas reglas no resuelven por sí solas todos los problemas: aún falta validar objetos individuales dentro de `records`, habilitar autenticación segura, proteger contra escrituras concurrentes, controlar cuotas y añadir recuperación. La autorización basada en UID presupone una identidad autenticada por Firebase, no un valor de UID escrito por el cliente.

## Advertencia de compatibilidad

**NO EJECUTAR `firebase deploy --only firestore:rules` sobre el proyecto real.** Las reglas preparadas niegan el acceso a la ruta `libro` que utiliza actualmente `index.html`. Desplegarlas sin migrar antes la app provocaría fallos de sincronización o bloqueo de acceso. Tampoco se recomienda copiar registros reales a un entorno de prueba.

## Verificación de reglas en un proyecto de prueba

Requisitos: Node.js, Firebase CLI, paquete `@firebase/rules-unit-testing` y el emulador Firestore local.

1. Trabajar en una copia aislada, sin credenciales ni asociación con el proyecto real. `firebase.json` solamente contiene configuración del emulador.
2. Instalar las dependencias de desarrollo necesarias en esa copia; no requiere introducir credenciales de producción.
3. Ejecutar el emulador y las pruebas con un identificador ficticio:

```sh
firebase emulators:exec --project demo-racional-security-tests --only firestore "node --test tests/firestore-security.test.cjs"
```

Las pruebas comprueban acceso anónimo, acceso de propietarios, aislamiento entre usuarios, estructura documental y bloqueo de borrados. Para evitar falsas garantías, si falta `@firebase/rules-unit-testing` el archivo marca los casos como omitidos; **una ejecución con pruebas omitidas NO equivale a una auditoría superada**. Si el emulador no está activo se aborta, evitando peticiones a producción.

## Plan de adopción (no ejecutado)

1. Revisar con acceso administrativo y de solo lectura las reglas **desplegadas** del proyecto Firebase, en su consola. No copiar ni compartir documentos de usuarios.
2. Confirmar política de cuentas: una cuenta personal, varias cuentas o acceso compartido. Activar Firebase Authentication en un proyecto de ensayo.
3. Migrar la aplicación en una rama adicional a rutas por UID, con validación explícita de sesión; separar operaciones de lectura y escritura.
4. Diseñar copia de seguridad, migración y reversión. Evitar que un `set({records})` sobrescriba ediciones concurrentes; evaluar movimientos en documentos individuales.
5. Probar reglas y cliente juntos en el emulador, incluyendo conflictos, errores, autenticación y recuperación.
6. Solo después de revisión manual, aprobación explícita y backup verificado, plantear el despliegue. **Esta auditoría no cambia producción.**

## Riesgos aún abiertos

- Exposición potencial de datos si las reglas reales de `libro` permiten clientes no autorizados.
- Colisión / pérdida de actualizaciones por sobrescritura del documento completo.
- Ausencia de recuperación comprobada de la copia local.
- No se confirmó App Check ni se actualizaron dependencias externas.
- No se ha ejecutado aún la suite real del emulador ni una prueba de navegador.
