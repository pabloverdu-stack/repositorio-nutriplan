# Base de datos conjunta BEDCA + USDA

## Por qué existe esto

BEDCA (la tabla de composición de alimentos española) es la fuente principal del programa,
pero hay cuatro nutrientes que apenas mide. De sus 2.336 alimentos:

| Nutriente | Alimentos con el dato en BEDCA |
|---|---|
| Cobre | 378 (16 %) |
| Manganeso | 339 (15 %) |
| Ácido pantoténico (B5) | 302 (13 %) |
| Azúcares | 397 (17 %) |
| **Biotina (B8)** | **103 (4 %)** |

Para comparar, calcio está en el 92 % y hierro en el 90 %.

Con esos huecos, la receta típica del recetario tenía **cero** ingredientes con cobre o
manganeso medidos, así que el programa nunca podía decir si la dieta los cubría.

## Qué se ha hecho

Se rellenan **solo los huecos** de cobre, manganeso, B5 y azúcares con datos de
**USDA FoodData Central, colección SR Legacy (abril 2018)**, que sí los mide de forma
generalizada (cobre 94 %, manganeso 83 %, B5 82 %, azúcares 77 %).

**BEDCA siempre manda.** Si BEDCA tiene el valor, no se toca.

El emparejamiento entre alimentos españoles y estadounidenses **no es automático**: se probó
un emparejador por nombre y daba entre un 10 y un 20 % de errores silenciosos (por ejemplo
«Oyster, raw» → «Mushrooms, oyster, raw», o «Apple» → «Rose-apples»). Para un programa de
nutrición clínica eso no vale.

En su lugar se acotó el problema: **el recetario entero (3.137 recetas) usa solo 187 alimentos
distintos**. Esos 187 se han emparejado y revisado **uno a uno**, a mano. La tabla está en
[`correspondencias.py`](correspondencias.py), con un comentario por línea, y se puede corregir.

## Resultado

Cobertura por gramos en las recetas, antes y después:

| Nutriente | Antes (mediana) | Después (mediana) |
|---|---|---|
| Cobre | 0 % | 100 % |
| Manganeso | 0 % | 100 % |
| Ác. pantoténico | 0 % | 100 % |
| Azúcares | 0 % | 100 % |
| Biotina | 0 % | 0 % (sin arreglo posible) |

Se añadieron **609 valores a 170 alimentos**.

## La biotina no se puede arreglar

Se comprobaron las tres tablas públicas descargables y **ninguna publica biotina de forma
generalizada**:

- BEDCA: 103 de 2.336 alimentos (4 %)
- USDA SR Legacy: **0** alimentos (no incluye el nutriente)
- CIQUAL 2020 (Francia, ANSES): no incluye la columna de biotina

La biotina requiere un análisis microbiológico caro que los laboratorios de composición de
alimentos rara vez hacen. Por eso el programa la deja marcada como **«s/d»** en gris en vez de
en rojo: decir que una dieta «no llega» a la biotina cuando no hay con qué sumarla sería falso.

Las únicas fuentes con biotina amplia son de pago o requieren registro manual
(Frida de Dinamarca, BLS alemana, NEVO holandesa). Si en algún momento consigues una,
se puede añadir con el mismo mecanismo.

## Qué archivo hace qué

| Archivo | Para qué sirve |
|---|---|
| `correspondencias.py` | **La tabla revisada a mano.** Un alimento BEDCA → un alimento USDA. Es lo que hay que editar si ves un emparejamiento que no te convence. |
| `extraer_usda.py` | Baja USDA (6 MB) y extrae los cuatro nutrientes a `usda_sr_legacy.json`. Se ejecuta una vez. |
| `usda_sr_legacy.json` | Los 7.651 alimentos USDA con sus cuatro valores. Ya está en el repositorio, no hace falta volver a bajarlo. |
| `fusionar.py` | Aplica la fusión, recalcula las recetas y genera el informe. |
| `relleno.json` | El resultado: qué valor se añade a qué alimento. Lo lee `nutricion.py`. |
| `copia_seguridad/` | Los dos recetarios tal como estaban antes de la fusión. Puedes borrarlos cuando estés conforme. |
| `../informe_fusion_bedca_usda.xlsx` | **El informe para ti**: los 609 valores añadidos, de qué alimento USDA sale cada uno y si la equivalencia es exacta o aproximada. |

## Cómo volver a generarlo

```bash
python datos_usda/fusionar.py
```

Actualiza `datos_bedca/catalogo.json`, `app/data/catalogo.json`, los dos `recetario.json` y el
informe. Si editas `correspondencias.py`, vuelve a lanzarlo.

Después, sube el número de versión en `app/index.html` (`?v=30` → `?v=31`) para que el
navegador no sirva los datos antiguos de su caché.

## Equivalencias marcadas como aproximadas

En el informe, la columna «Tipo de equivalencia» distingue:

- **Equivalente**: mismo alimento y misma preparación (tomate crudo → *Tomatoes, red, ripe, raw*).
- **Aproximado**: la especie, el corte o la preparación difieren algo. Los principales:
  merluza → *whiting*, dorada a la plancha → *sea bass, cooked*, bonito al vapor → *tuna,
  bluefin, cooked*, gallo → *flatfish*, jamón serrano → *pork, cured ham, unheated*,
  requesón y queso de Burgos → *cottage cheese*, queso curado → *cheddar*, arándano →
  *blueberries*, muesli → *granola*.

Para minerales como el cobre o el manganeso esas diferencias son pequeñas; conviene tenerlas
presentes si algún día alguien pregunta de dónde sale un número concreto.

## Lo que se ha dejado fuera a propósito

- **Los cereales de desayuno de marca** (9 alimentos, el 0,00 % de los gramos del recetario):
  USDA solo tiene marcas estadounidenses y cualquier equivalencia sería inventada.
- **Los otros ~2.100 alimentos del catálogo BEDCA** que el recetario no usa. Solo se alcanzan
  desde el Constructor, eligiendo un alimento suelto, y ahí el programa marca «s/d» si no hay
  dato. Si quieres cubrir alguno, añade su línea a `correspondencias.py` y vuelve a lanzar
  `fusionar.py`.
