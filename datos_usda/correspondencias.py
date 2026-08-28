# -*- coding: utf-8 -*-
"""
Correspondencias BEDCA -> USDA SR Legacy, REVISADAS UNA A UNA.

Sirven para rellenar los cuatro nutrientes que BEDCA apenas mide:
cobre, manganeso, ácido pantoténico (B5) y azúcares.

Cada fila es:  f_id_BEDCA: (fdc_id_USDA, "nota", excluir)
  · f_id_BEDCA  id del alimento en datos_bedca/bedca_raw.json
  · fdc_id_USDA id del alimento en USDA FoodData Central (SR Legacy)
  · nota        "=" equivalente directo | "~" aproximación (especie, corte o
                preparación algo distinta); las "~" van marcadas en el informe
  · excluir     nutrientes que NO deben copiarse de ese alimento USDA porque
                el producto no es comparable en ese punto concreto

Solo se rellenan huecos: si BEDCA ya tiene el valor, manda BEDCA.
Están cubiertos los 187 alimentos que usa el recetario. Los cereales de
desayuno de marca se dejan a propósito sin emparejar: USDA solo tiene marcas
estadounidenses y cualquier equivalencia sería inventada.
"""

# f_id: (fdc_id, tipo, excluir)
MAPA = {
    # ---------- Lácteos y huevos ----------
    "953":  (171284, "~", ()),   # Yogur búlgaro            -> Yogurt, plain, whole milk
    "2520": (171304, "=", ()),   # Yogur griego             -> Yogurt, Greek, plain, whole milk
    "118":  (171304, "=", ()),   # Yogur griego
    "1319": (171267, "=", ()),   # Leche semidesnatada      -> Milk, reduced fat 2%
    "1694": (171265, "=", ()),   # Leche entera             -> Milk, whole 3.25%
    "1316": (171269, "=", ()),   # Leche desnatada          -> Milk, nonfat
    "1845": (172446, "=", ()),   # Leche de soja            -> Soymilk, original, unfortified
    "2517": (172179, "~", ()),   # Requesón                 -> Cheese, cottage, creamed
    "1794": (172179, "~", ()),   # Queso fresco de Burgos   -> Cheese, cottage, creamed
    "2510": (170845, "=", ()),   # Mozzarella               -> Cheese, mozzarella, whole milk
    "1903": (170845, "~", ()),   # Queso tierno genérico    -> Cheese, mozzarella, whole milk
    "1901": (170899, "~", ()),   # Queso curado genérico    -> Cheese, cheddar, sharp
    "1872": (170848, "=", ()),   # Parmesano                -> Cheese, parmesan, hard
    "940":  (171290, "~", ()),   # Queso fundido extragraso -> Cheese, pasteurized process, American
    "2127": (171287, "=", ()),   # Huevo fresco             -> Egg, whole, raw, fresh
    "2126": (173424, "=", ()),   # Huevo duro               -> Egg, whole, cooked, hard-boiled
    "545":  (173423, "=", ()),   # Huevo frito              -> Egg, whole, cooked, fried

    # ---------- Verduras y hortalizas ----------
    "2403": (170026, "=", ()),   # Patata cruda             -> Potatoes, flesh and skin, raw
    "312":  (170379, "=", ()),   # Brécol crudo             -> Broccoli, raw
    "1894": (170108, "=", ()),   # Pimiento rojo crudo      -> Peppers, sweet, red, raw
    "1847": (170427, "=", ()),   # Pimiento verde crudo     -> Peppers, sweet, green, raw
    "2387": (170397, "=", ()),   # Coliflor hervida         -> Cauliflower, cooked, boiled
    "1776": (169291, "=", ()),   # Calabacín                -> Squash, summer, zucchini, raw
    "2376": (169291, "=", ()),   # Calabacín
    "1892": (170393, "=", ()),   # Zanahoria cruda          -> Carrots, raw
    "2384": (169251, "=", ()),   # Champiñón                -> Mushrooms, white, raw
    "2008": (168580, "~", ()),   # Seta plancha             -> Mushrooms, oyster, raw
    "1175": (170016, "=", ()),   # Guisante congelado crudo -> Peas, green, frozen, unprepared
    "1678": (170013, "=", ()),   # Guisantes en conserva    -> Peas, green, canned, drained
    "151":  (168389, "=", ()),   # Espárrago verde          -> Asparagus, raw
    "2198": (169961, "=", ()),   # Judía verde cruda        -> Beans, snap, green, raw
    "1919": (169961, "=", ()),   # Judía verde cruda
    "2397": (169141, "=", ()),   # Judía verde hervida      -> Beans, snap, green, cooked, boiled
    "2395": (168463, "=", ()),   # Espinaca hervida         -> Spinach, cooked, boiled
    "1922": (169991, "=", ()),   # Acelga cruda             -> Chard, swiss, raw
    "1183": (168449, "=", ()),   # Calabaza hervida         -> Pumpkin, cooked, boiled
    "1920": (168448, "=", ()),   # Calabaza cruda           -> Pumpkin, raw
    "2378": (168448, "=", ()),   # Calabaza cruda
    "1773": (170000, "=", ()),   # Cebolla                  -> Onions, raw
    "1979": (170001, "~", ()),   # Cebolla asada            -> Onions, cooked, boiled
    "1921": (169228, "=", ()),   # Berenjena                -> Eggplant, raw
    "1775": (169247, "=", ()),   # Lechuga                  -> Lettuce, cos or romaine, raw
    "2399": (169247, "=", ()),   # Lechuga
    "2407": (168409, "=", ()),   # Pepino                   -> Cucumber, with peel, raw
    "1772": (168409, "=", ()),   # Pepino
    "2411": (169246, "=", ()),   # Puerro                   -> Leeks, raw
    "1774": (169230, "=", ()),   # Ajo                      -> Garlic, raw
    "2361": (169230, "=", ()),   # Ajo
    "1879": (170457, "=", ()),   # Tomate                   -> Tomatoes, red, ripe, raw
    "2421": (170457, "=", ()),   # Tomate
    "1759": (170054, "~", ()),   # Tomate frito             -> Tomato products, canned, sauce
    "2406": (169379, "=", ()),   # Pepinillos en vinagre    -> Pickles, cucumber, sour
    "1623": (171706, "=", ()),   # Aguacate                 -> Avocados, raw, California

    # ---------- Frutas ----------
    "2231": (171688, "=", ()),   # Manzana                  -> Apples, raw, with skin
    "2245": (173944, "=", ()),   # Plátano                  -> Bananas, raw
    "1737": (173944, "=", ()),   # Plátano
    "2225": (167762, "=", ()),   # Fresa                    -> Strawberries, raw
    "1671": (167762, "=", ()),   # Fresa
    "2235": (169097, "=", ()),   # Naranja                  -> Oranges, raw
    "1729": (169118, "=", ()),   # Pera                     -> Pears, raw
    "2228": (168153, "=", ()),   # Kiwi                     -> Kiwifruit, green, raw
    "1689": (168153, "=", ()),   # Kiwi
    "2011": (171711, "~", ()),   # Arándano                 -> Blueberries, raw
    "2368": (171711, "~", ()),   # Arándano
    "2220": (171719, "=", ()),   # Cereza                   -> Cherries, sweet, raw
    "1705": (169105, "=", ()),   # Mandarina                -> Tangerines, raw
    "1017": (174683, "=", ()),   # Uva negra cruda          -> Grapes, red or green, raw
    "2227": (173021, "=", ()),   # Higos y brevas           -> Figs, raw
    "1711": (169928, "=", ()),   # Melocotón                -> Peaches, yellow, raw
    "2234": (169092, "~", ()),   # Melón                    -> Melons, cantaloupe, raw
    "2247": (167765, "=", ()),   # Sandía                   -> Watermelon, raw
    "2224": (168191, "=", ()),   # Dátil                    -> Dates, medjool
    "1762": (168165, "=", ()),   # Uva pasa                 -> Raisins, dark, seedless
    "1962": (169944, "=", ()),   # Piña en almíbar          -> Pineapple, canned, heavy syrup
    "411":  (167747, "=", ()),   # Zumo de limón fresco     -> Lemon juice, raw

    # ---------- Cereales, pan y legumbres ----------
    "1117": (169736, "=", ()),   # Pasta cruda              -> Pasta, dry, enriched
    "1364": (169736, "=", ()),   # Pasta cruda
    "1074": (169738, "=", ()),   # Pasta integral cruda     -> Pasta, whole-wheat, dry
    "1630": (168877, "=", ()),   # Arroz                    -> Rice, white, long-grain, raw
    "904":  (169703, "=", ()),   # Arroz integral crudo     -> Rice, brown, long-grain, raw
    "56":   (169703, "=", ()),   # Arroz integral crudo
    "1083": (168874, "=", ()),   # Quinoa cruda             -> Quinoa, uncooked
    "1010": (173904, "=", ()),   # Avena cruda              -> Cereals, oats, regular and quick, dry
    "59":   (173904, "=", ()),   # Avena cruda
    "2163": (172688, "=", ()),   # Pan integral             -> Bread, whole-wheat
    "2164": (172689, "=", ()),   # Pan integral molde tost. -> Bread, whole-wheat, toasted
    "1810": (174924, "=", ()),   # Pan blanco de barra      -> Bread, white, commercially prepared
    "2160": (174924, "=", ()),   # Pan blanco de barra
    "1792": (174925, "=", ()),   # Pan blanco molde tostado -> Bread, white, toasted
    "1912": (172684, "=", ()),   # Pan de centeno           -> Bread, rye
    "2174": (172796, "=", ()),   # Pan tipo hamburguesa     -> Rolls, hamburger or hotdog
    "2171": (174928, "=", ()),   # Pan rallado              -> Bread, crumbs, dry, grated
    "1292": (175250, "=", ()),   # Garbanzo en conserva     -> Chickpeas, canned, solids and liquids
    "1126": (172421, "~", ()),   # Lenteja en conserva      -> Lentils, cooked, boiled
    "1324": (172421, "~", ()),   # Lenteja en conserva
    "898":  (175204, "=", ()),   # Alubia blanca conserva   -> Beans, white, canned
    "1121": (172475, "=", ()),   # Tofu                     -> Tofu, raw, firm
    "2155": (171646, "~", ()),   # Cereales muesli          -> Cereals RTE, granola, homemade
    "2065": (171646, "~", ()),   # Cereales muesli
    "1878": (171646, "~", ()),   # Muesli

    # ---------- Pescados y mariscos ----------
    "2347": (173713, "~", ()),   # Merluza fresca           -> Fish, whiting, mixed species, raw
    "2626": (175167, "=", ()),   # Salmón                   -> Fish, salmon, Atlantic, farmed, raw
    "2302": (171955, "=", ()),   # Bacalao crudo            -> Fish, cod, Atlantic, raw
    "1915": (171955, "=", ()),   # Bacalao crudo
    "2623": (173676, "=", ()),   # Rape crudo               -> Fish, monkfish, raw
    "2344": (175142, "=", ()),   # Lubina                   -> Fish, sea bass, mixed species, raw
    "2029": (173694, "~", ()),   # Dorada plancha           -> Fish, sea bass, cooked, dry heat
    "800":  (173707, "~", ()),   # Bonito del norte vapor   -> Fish, tuna, fresh, bluefin, cooked
    "2636": (173717, "=", ()),   # Trucha                   -> Fish, trout, rainbow, farmed, raw
    "2134": (175159, "=", ()),   # Atún crudo               -> Fish, tuna, fresh, yellowfin, raw
    "2341": (174196, "=", ()),   # Lenguado                 -> Fish, flatfish (flounder/sole), raw
    "2336": (174196, "~", ()),   # Gallo                    -> Fish, flatfish (flounder/sole), raw
    "1934": (175119, "=", ()),   # Caballa cruda            -> Fish, mackerel, Atlantic, raw
    "2630": (175139, "=", ()),   # Sardina                  -> Fish, sardine, canned in oil
    "2316": (174182, "=", ()),   # Boquerón                 -> Fish, anchovy, european, raw
    "2131": (173708, "=", ()),   # Atún en aceite vegetal   -> Fish, tuna, light, canned in oil
    "2042": (173708, "=", ()),   # Atún en aceite vegetal
    "807":  (174223, "=", ()),   # Calamar crudo            -> Mollusks, squid, mixed species, raw
    "2635": (174215, "=", ()),   # Sepia                    -> Mollusks, cuttlefish, raw
    "1854": (174215, "=", ()),   # Sepia
    "1738": (174218, "=", ()),   # Pulpo                    -> Mollusks, octopus, common, raw
    "1710": (174216, "=", ()),   # Mejillón                 -> Mollusks, mussel, blue, raw
    "2345": (174216, "=", ()),   # Mejillón
    "824":  (174217, "=", ()),   # Mejillón hervido         -> Mollusks, mussel, blue, cooked
    "2020": (171971, "=", ()),   # Gamba hervida            -> Crustaceans, shrimp, cooked, moist heat
    "2337": (171971, "=", ()),   # Gamba hervida
    "817":  (174210, "=", ()),   # Gamba roja cruda         -> Crustaceans, shrimp, raw

    # ---------- Carnes ----------
    "994":  (171474, "=", ()),   # Pollo pechuga c/piel cru -> Chicken, breast, meat and skin, raw
    "1899": (171477, "=", ()),   # Pollo pechuga plancha    -> Chicken, breast, meat only, roasted
    "1388": (172385, "=", ()),   # Pollo muslo c/piel crudo -> Chicken, thigh, meat and skin, raw
    "990":  (171496, "=", ()),   # Pavo pechuga s/piel plan -> Turkey, breast, meat only, roasted
    "1371": (171093, "=", ()),   # Pavo pechuga c/piel crud -> Turkey, breast, meat and skin, raw
    "2286": (174572, "=", ()),   # Pavo fiambre             -> Turkey breast, deli, luncheon meat
    "1699": (174572, "=", ()),   # Pavo fiambre
    "2259": (168230, "=", ()),   # Cerdo lomo crudo         -> Pork, loin, whole, lean only, raw
    "447":  (168249, "=", ()),   # Cerdo solomillo crudo    -> Pork, loin, tenderloin, lean only, raw
    "981":  (171812, "=", ()),   # Vaca solomillo crudo     -> Beef, tenderloin, lean only, raw
    "304":  (171812, "=", ()),   # Vaca solomillo crudo
    "1931": (171796, "=", ()),   # Carne picada             -> Beef, ground, 85/15, raw
    "964":  (174346, "=", ()),   # Conejo estofado          -> Game meat, rabbit, cooked, stewed
    "965":  (173864, "=", ()),   # Jamón cocido             -> Ham, sliced, regular
    "2273": (167876, "~", ()),   # Jamón serrano            -> Pork, cured, ham, lean only, unheated
    "1814": (167876, "~", ()),   # Jamón serrano
    "1661": (173859, "=", ()),   # Chorizo                  -> Sausage, pork, chorizo, raw
    "602":  (167914, "=", ()),   # Bacón a la parrilla      -> Pork, cured, bacon, cooked, baked
    "2260": (167812, "=", ()),   # Cerdo panceta cruda      -> Pork, fresh, belly, raw

    # ---------- Frutos secos ----------
    "2201": (170187, "=", ()),   # Nuez                     -> Nuts, walnuts, english
    "1633": (170581, "=", ()),   # Avellana                 -> Nuts, hazelnuts or filberts
    "2207": (170184, "=", ()),   # Pistacho                 -> Nuts, pistachio nuts, raw
    "922":  (170162, "=", ()),   # Anacardo crudo           -> Nuts, cashew nuts, raw
    "534":  (170567, "=", ()),   # Almendra cruda           -> Nuts, almonds
    "1238": (172430, "=", ()),   # Cacahuete crudo          -> Peanuts, all types, raw
    "979":  (172470, "=", ()),   # Crema de cacahuete       -> Peanut butter, smooth, without salt
    "539":  (172470, "=", ()),   # Crema de cacahuete

    # ---------- Grasas, salsas y otros ----------
    "2544": (171413, "=", ()),   # AOVE                     -> Oil, olive, salad or cooking
    "1619": (169094, "=", ()),   # Aceituna                 -> Olives, ripe, canned
    "1929": (173594, "=", ()),   # Mayonesa light           -> Salad dressing, mayonnaise, light
    "2554": (173594, "=", ()),   # Mayonesa light
    "1842": (168556, "=", ()),   # Ketchup                  -> Catsup
    "1798": (172234, "=", ()),   # Mostaza                  -> Mustard, prepared, yellow
    "2643": (169640, "=", ()),   # Miel                     -> Honey
    "28":   (170273, "=", ()),   # Chocolate negro          -> Chocolate, dark, 70-85% cacao
    # El cacao de BEDCA lleva azúcar y el de USDA no: se copian minerales y B5, no los azúcares
    "1891": (169593, "~", ("azucares_g",)),   # Cacao en polvo azucarado -> Cocoa, dry powder, unsweetened
    "2462": (174837, "=", ()),   # Vino blanco              -> Alcoholic beverage, wine, table, white

    # ---------- Especias ----------
    "2477": (171320, "=", ()),   # Canela en polvo          -> Spices, cinnamon, ground
    "400":  (171329, "=", ()),   # Pimentón en polvo        -> Spices, paprika
    "1374": (170416, "=", ()),   # Perejil fresco           -> Parsley, fresh
    "1992": (170924, "=", ()),   # Curry                    -> Spices, curry powder
    "1353": (171328, "=", ()),   # Orégano seco             -> Spices, oregano, dried
    "1220": (170934, "=", ()),   # Azafrán                  -> Spices, saffron
}

# Alimentos del recetario que se dejan SIN emparejar a propósito, con el motivo.
SIN_EMPAREJAR = {
    "1036": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "1042": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "100":  "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "1038": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "1119": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "107":  "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "2666": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "1026": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
    "1039": "Cereal de desayuno de marca: USDA solo tiene marcas de EE. UU.",
}

# Nutrientes que se rellenan y su equivalencia con los ids de USDA
NUTRIENTES_USDA = {
    "cobre_mg":       (1098, "Copper, Cu",       "mg"),
    "manganeso_mg":   (1101, "Manganese, Mn",    "mg"),
    "pantotenico_mg": (1170, "Pantothenic acid", "mg"),
    "azucares_g":     (2000, "Sugars, Total",    "g"),
}
