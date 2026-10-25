# Kleenex Pollen Radar

## Presentación

Esta integración trae a Gladys el **polen contado por el radar de polen de Kleenex** (Scottex en Italia), para una a tres ciudades: el número de granos de polen por m³ de aire de **árboles**, **gramíneas** y **herbáceas**, su nivel (bajo, moderado, alto, muy alto), las **especies principales** (abedul, ambrosía, gramíneas…) y la previsión de los cuatro días siguientes. Cada ciudad se convierte en un dispositivo para mostrar en un panel y usar en las escenas.

Países cubiertos: **Francia**, **Reino Unido e Irlanda**, **Países Bajos**, **Italia** y **Estados Unidos**. No hace falta cuenta ni clave. En Estados Unidos, el radar no da el detalle por especie.

Este conector **no es oficial** y no está afiliado ni a Kleenex ni a Kimberly-Clark. Lee los mismos datos que el sitio, sin API documentada: si el sitio cambia, puede dejar de funcionar hasta una actualización.

Es una integración **en la nube**: consulta el sitio de Kleenex del país elegido cada tres horas, una petición por ciudad, y guarda la última previsión, así que un reinicio no cuesta ninguna petición.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior.
- El nombre o el código postal de las ciudades que seguir, tal como los entiende el sitio del radar de polen.

## Configuración

| Campo                | Qué escribir                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| País                 | El radar de polen consultado para todas las ciudades. Francia por defecto.                                |
| Ciudad               | «Milano», «Roma», «Leeds», «Mâcon», «71000»… Para Irlanda, añada el país: «Dublin, Ireland». Obligatorio. |
| Ciudad 2, Ciudad 3   | Otras ciudades (segunda residencia, trabajo, colegio). Opcional.                                          |
| Idioma de los textos | Nombres de dispositivos, polen principal y resúmenes de escenas. Automático: su panel.                    |

Guarde: el estado en lo alto de la página muestra las ciudades leídas, su nivel de polen de hoy y la hora de la próxima lectura. Una ciudad desconocida se indica ahí: pruebe otra grafía o el código postal. **Leer ahora** vuelve a leer en el acto (como mucho cada 10 minutos).

## Uso

### Dispositivos

En la pestaña **Descubrir**, cree el dispositivo «Polen …» de cada ciudad. Contiene:

- el nivel de polen de hoy y de mañana, de 1 (bajo) a 4 (muy alto): el más alto de los tres tipos;
- el número de granos por m³ de árboles, gramíneas y herbáceas hoy (el sitio escribe «PPM»);
- el nivel de cada tipo hoy, de 1 a 4;
- el polen principal como texto, por ejemplo «Ambrosía 13».

Un nivel es una cifra de 1 a 4, no un índice de calidad del aire: Gladys no tiene unidad para el polen, así que estas funcionalidades no muestran ninguna. El dispositivo se identifica por la ubicación que devuelve el radar: otra grafía que encuentre el mismo lugar conserva el mismo dispositivo. El estado de la configuración muestra el nombre que encontró el radar: compruébelo.

### Widgets del panel

![El widget Radar de polen para Mâcon (árboles, gramíneas, herbáceas, cinco días) y el widget Especies de polen (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-kleenex-pollen/main/docs/assets/widgets.es.png)

- **Radar de polen**: los tres tipos de hoy, una tarjeta por día durante cinco días (nivel, recuentos, especies principales), el polen principal, la fuente y la hora de lectura.
- **Especies de polen**: las especies contadas hoy, las más presentes primero, con su nivel.

Elija la ciudad en los ajustes del widget (vacío: la primera).

### Escenas

El disparador **Kleenex: alerta de polen** se activa cuando los árboles, las gramíneas o las herbáceas de hoy o de mañana llegan a «Moderado» o más, o vuelven a subir; nunca dos veces para el mismo día, tipo y nivel. Filtre por ciudad, tipo de polen, día y nivel («Alto» y «Muy alto» para la mayoría de los alérgicos). Da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (tipo, nivel, recuento, especies).

La acción **Kleenex: leer el polen** devuelve el nivel, los recuentos y el polen principal de una ciudad para hoy o mañana, para un mensaje o una condición.

Ejemplos:

- Cuando las gramíneas estén altas mañana → enviar el resumen por la tarde.
- Cuando los árboles estén muy altos hoy → cerrar las ventanas del dormitorio.
- Cada mañana → leer el polen y anunciarlo con el despertador.

### Transporte

Solo nube: los datos vienen del sitio de Kleenex (o Scottex) del país elegido. Solo los nombres de las ciudades escritas salen de su red.

## Solución de problemas

- **«desconocida para el radar de polen»**: el sitio no conoce esta grafía; pruebe el código postal o una ciudad grande cercana.
- **«rechazó la petición (HTTP 403)»**: el sitio bloqueó la petición; la integración lo reintenta en 15 minutos y luego cada vez más tarde.
- **«puede que el sitio haya cambiado»**: la página ya no se parece a la que la integración sabe leer. Avísenos: hará falta una actualización.
- **El nivel se queda en 1**: fuera de la temporada de polen es normal; los recuentos se quedan en 0 o casi.
- **Para informar de un problema**: pulse **Diagnóstico** y copie las líneas que empiezan por «Pollen diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
