# Revisión local del respaldo antes de importar

El propietario mostró que el archivo se lee, pero la validación rechaza al
menos un movimiento antes de presentar la confirmación. No se importó nada.
El agente no recibió ni leyó el respaldo financiero.

Se revisó el código del commit original d22b379: exporta `{records:[...]}`;
los movimientos nuevos contienen tipo/monto/desc/fecha/hora/clp/tc/etf/acciones,
y los ajustes automáticos pueden omitir hora y acciones. Ese formato legado
válido está cubierto por un test, incluyendo rendimiento negativo y cancelación
sin modificar la vista ni escribir en nube. No se identificó todavía el campo
concreto del respaldo real que falla.

El importador ahora diferencia un contenedor sin `records`, más de 10000 filas,
campos inválidos e identificadores duplicados/orden incompatible. La revisión
de campos se ejecuta únicamente en el navegador del propietario y muestra
solo nombres controlados de campos y cantidad de filas afectadas. No muestra
montos, notas, fechas, correos, tokens ni nombres arbitrarios de propiedades.

No se convierten números, signos o fechas por suposición; no se eliminan filas
inválidas ni se omiten validaciones para forzar la importación. El respaldo
original no se sobrescribe. La normalización válida se conserva después de la
confirmación, sin generar IDs diferentes dos veces.

67 tests locales aprobados, incluidos diagnósticos sin valores privados,
propiedades desconocidas, JSON nulo y compatibilidad con el exportador legado.
Falta conocer el resultado de la revisión local y revisar después los conteos
de sustitución y el límite de 400 cambios antes de aceptar una importación real.
