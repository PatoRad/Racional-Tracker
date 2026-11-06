# Revisión local del respaldo antes de importar

El propietario mostró que el archivo se lee, pero la validación rechaza al
menos un movimiento antes de presentar la confirmación. No se importó nada.
El agente no recibió ni leyó el respaldo financiero.

Se revisó el código del commit original d22b379: exporta `{records:[...]}`;
los movimientos nuevos contienen tipo/monto/desc/fecha/hora/clp/tc/etf/acciones,
y los ajustes automáticos pueden omitir hora y acciones. Ese formato legado
válido está cubierto por un test, incluyendo rendimiento negativo y cancelación
sin modificar la vista ni escribir en nube. La siguiente captura del propietario
identificó únicamente dos filas con problema en `fecha`; no se compartieron valores.

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

## Compatibilidad conservadora de fechas legadas

Se añadió normalización exclusivamente para respaldos sin versión. Acepta el
orden día/mes/año documentado en el código antiguo, con `/` o `-` y día/mes de
uno o dos dígitos, y fechas ISO de solo día `YYYY-MM-DD`. El resultado es
`DD/MM/YYYY` con el mismo día, mes y año. Se comprueban calendario real, años
bisiestos y rango 1900..2200. No se aceptan mezclas de separadores, fechas con
hora/zona, números, fechas vacías ni fechas imposibles. No se interpreta un
formato mes/día/año por suposición. Los respaldos versionados conservan su
validación estricta, incluido el propietario.

La conversión solo modifica la copia local propuesta; nunca el archivo original.
La confirmación informa cuántos formatos cambiarían y los conteos de sustitución
antes de permitir guardado. Cancelar no cambia la vista ni la nube. Si sigue
fallando, el aviso distingue ausencia, tipo, formato o calendario/rango sin
mostrar fechas. No se cambia ningún monto ni se descartan registros.

72 tests locales aprobados. Se verificaron fechas válidas e inválidas, cancelación
de dos cambios de formato, archivo original intacto, control de versión y
persistencia UTC correcta de una fecha sintética tras consentimiento. Falta
comprobar localmente si las dos fechas reales son formatos compatibles; no se
afirma haber reparado ni importado el respaldo del propietario.
