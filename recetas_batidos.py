# -*- coding: utf-8 -*-
"""Batidos con crema de cacahuete (desayuno y merienda).
Ingredientes por f_id de BEDCA, usando los mismos ids que el resto del recetario:
  1319 Leche semidesnatada · 2245 Platano · 1010 Copos de avena · 953 Yogur natural
  2520 Yogur griego · 979 Crema de cacahuete · 2224 Datiles · 2643 Miel
  2225 Fresas · 2477 Canela en polvo · 1891 Cacao en polvo azucarado
La crema de cacahuete son 619 kcal/100 g: una cucharada colmada (20 g) aporta ~124 kcal,
asi que conviene pesarla en lugar de servirla a ojo."""

def _r(id, nombre, tipo, t, ings, pasos):
    return {"id": id, "nombre": nombre, "tipo": tipo, "dificultad": "facil",
            "tiempo_min": t, "raciones": 1,
            "ingredientes": [{"f_id": f, "nombre": nm, "gramos": g, "casera": c} for f, nm, g, c in ings],
            "elaboracion": pasos}

# --- atajos ---
LECHE   = ("1319", "Leche semidesnatada", 250, "1 vaso grande")
LECHE_M = ("1319", "Leche semidesnatada", 200, "1 vaso")
PLATANO = ("2245", "Platano", 120, "1 unidad")
AVENA   = ("1010", "Copos de avena", 30, "3 cucharadas")
CREMA   = ("979", "Crema de cacahuete", 20, "1 cucharada colmada")
CREMA_S = ("979", "Crema de cacahuete", 15, "1 cucharada")
CANELA  = ("2477", "Canela en polvo", 1, "una pizca")

RECETAS = [

 _r("B001", "Batido de leche, platano y crema de cacahuete", "desayuno", 5,
    [LECHE, PLATANO, CREMA, AVENA],
    ["Pela el platano y trocealo.",
     "Pon en el vaso de la batidora la leche, el platano, la crema de cacahuete y los copos de avena.",
     "Tritura 30-40 segundos hasta que quede homogeneo y sin grumos de avena.",
     "Sirve al momento. Si lo quieres mas espeso, usa el platano congelado."]),

 _r("B002", "Batido de crema de cacahuete, platano y cacao", "desayuno", 5,
    [LECHE, ("2245", "Platano", 100, "1 unidad pequeña"), CREMA,
     ("1891", "Cacao en polvo azucarado", 10, "1 cucharada")],
    ["Trocea el platano.",
     "Tritura la leche con el platano, la crema de cacahuete y el cacao.",
     "Bate hasta que el cacao quede completamente disuelto.",
     "Sirve frio, con hielo si te apetece."]),

 _r("B003", "Batido de yogur griego, crema de cacahuete y avena", "desayuno", 5,
    [("2520", "Yogur griego", 125, "1 unidad"), ("1319", "Leche semidesnatada", 150, "1 vaso pequeño"),
     CREMA, AVENA, ("2643", "Miel", 10, "1 cucharadita")],
    ["Pon el yogur griego y la leche en el vaso de la batidora.",
     "Añade la crema de cacahuete, los copos de avena y la miel.",
     "Tritura hasta que espese y quede cremoso.",
     "Es el mas saciante de los batidos: va bien como desayuno unico."]),

 _r("B004", "Batido de leche, crema de cacahuete y datiles", "desayuno", 5,
    [LECHE, ("979", "Crema de cacahuete", 25, "1 cucharada muy colmada"),
     ("2224", "Datiles", 40, "2 unidades"), ("1010", "Copos de avena", 25, "2 cucharadas"), CANELA],
    ["Deshuesa los datiles y remojalos 5 min en la leche templada para que trituren mejor.",
     "Añade la crema de cacahuete, la avena y la canela.",
     "Tritura hasta que no queden trozos de datil.",
     "Los datiles endulzan sin azucar añadido: no hace falta echarle mas nada."]),

 _r("B005", "Batido de fresas, platano y crema de cacahuete", "merienda", 5,
    [LECHE_M, ("2225", "Fresas", 100, "un puñado"), ("2245", "Platano", 80, "1/2 unidad"), CREMA_S],
    ["Lava las fresas y quitales el rabito.",
     "Trocea el platano.",
     "Tritura todo junto con la leche y la crema de cacahuete.",
     "Sirve bien frio."]),

 _r("B006", "Batido rapido de leche, platano y crema de cacahuete", "merienda", 3,
    [LECHE, ("2245", "Platano", 100, "1 unidad pequeña"), CREMA_S],
    ["Trocea el platano.",
     "Tritura con la leche y la crema de cacahuete 30 segundos.",
     "Listo. Tres ingredientes y va bien despues de entrenar."]),
]
