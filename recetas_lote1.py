# -*- coding: utf-8 -*-
"""Lote 1 de recetas. De momento: 10 desayunos.
Cada ingrediente referencia un f_id de BEDCA (catalogo.json).
Los nutrientes se calculan aparte con nutricion.calcular()."""

RECETAS = [
    {
        "id": "D001", "nombre": "Tostada integral con huevo revuelto y AOVE",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 10, "raciones": 1,
        "ingredientes": [
            {"f_id": "2127", "nombre": "Huevo", "gramos": 120, "casera": "2 unidades"},
            {"f_id": "2163", "nombre": "Pan integral", "gramos": 60, "casera": "2 rebanadas"},
            {"f_id": "2544", "nombre": "Aceite de oliva virgen extra", "gramos": 10, "casera": "1 cucharada"},
        ],
        "elaboracion": [
            "Bate los huevos con una pizca de sal.",
            "Calienta la mitad del aceite en una sarten antiadherente a fuego medio-bajo y cuaja los huevos removiendo hasta dejarlos cremosos.",
            "Tuesta el pan y aliñalo con el resto del aceite.",
            "Sirve el revuelto sobre las tostadas.",
        ],
    },
    {
        "id": "D002", "nombre": "Bol de yogur con avena, platano y nueces",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 5, "raciones": 1,
        "ingredientes": [
            {"f_id": "953", "nombre": "Yogur natural", "gramos": 125, "casera": "1 unidad"},
            {"f_id": "59", "nombre": "Copos de avena", "gramos": 40, "casera": "4 cucharadas"},
            {"f_id": "1737", "nombre": "Platano", "gramos": 100, "casera": "1 pequeño"},
            {"f_id": "2201", "nombre": "Nueces", "gramos": 20, "casera": "3 nueces"},
        ],
        "elaboracion": [
            "Pon el yogur en un bol.",
            "Añade los copos de avena y mezcla.",
            "Corta el platano en rodajas y reparte por encima.",
            "Termina con las nueces troceadas.",
        ],
    },
    {
        "id": "D003", "nombre": "Tortilla francesa con tomate aliñado y pan",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 10, "raciones": 1,
        "ingredientes": [
            {"f_id": "2127", "nombre": "Huevo", "gramos": 120, "casera": "2 unidades"},
            {"f_id": "2544", "nombre": "Aceite de oliva virgen extra", "gramos": 5, "casera": "1/2 cucharada"},
            {"f_id": "1879", "nombre": "Tomate", "gramos": 100, "casera": "1 unidad"},
            {"f_id": "2163", "nombre": "Pan integral", "gramos": 40, "casera": "1 rebanada"},
        ],
        "elaboracion": [
            "Bate los huevos con una pizca de sal.",
            "Cuaja la tortilla en una sarten con el aceite, doblandola por la mitad.",
            "Corta el tomate en rodajas y aliñalo con unas gotas de aceite y sal.",
            "Acompaña con el pan.",
        ],
    },
    {
        "id": "D004", "nombre": "Porridge de avena con leche, manzana y canela",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 10, "raciones": 1,
        "ingredientes": [
            {"f_id": "59", "nombre": "Copos de avena", "gramos": 50, "casera": "5 cucharadas"},
            {"f_id": "1319", "nombre": "Leche semidesnatada", "gramos": 200, "casera": "1 vaso"},
            {"f_id": "2231", "nombre": "Manzana", "gramos": 100, "casera": "1 pequeña"},
            {"f_id": "2477", "nombre": "Canela en polvo", "gramos": 1, "casera": "1 pizca"},
        ],
        "elaboracion": [
            "Calienta la leche con la avena a fuego medio, removiendo, hasta que espese (unos 5 min).",
            "Ralla o trocea la manzana y añadela.",
            "Espolvorea la canela y sirve caliente.",
        ],
    },
    {
        "id": "D005", "nombre": "Tostada con tomate, AOVE y jamon serrano",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 8, "raciones": 1,
        "ingredientes": [
            {"f_id": "2163", "nombre": "Pan integral", "gramos": 60, "casera": "2 rebanadas"},
            {"f_id": "1879", "nombre": "Tomate", "gramos": 80, "casera": "1/2 unidad"},
            {"f_id": "2544", "nombre": "Aceite de oliva virgen extra", "gramos": 10, "casera": "1 cucharada"},
            {"f_id": "1814", "nombre": "Jamon serrano", "gramos": 40, "casera": "2 lonchas"},
        ],
        "elaboracion": [
            "Tuesta el pan.",
            "Ralla el tomate y repartelo sobre las tostadas.",
            "Riega con el aceite de oliva.",
            "Coloca el jamon serrano por encima.",
        ],
    },
    {
        "id": "D006", "nombre": "Batido de leche, platano y avena",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 5, "raciones": 1,
        "ingredientes": [
            {"f_id": "1319", "nombre": "Leche semidesnatada", "gramos": 250, "casera": "1 vaso grande"},
            {"f_id": "1737", "nombre": "Platano", "gramos": 120, "casera": "1 unidad"},
            {"f_id": "59", "nombre": "Copos de avena", "gramos": 30, "casera": "3 cucharadas"},
        ],
        "elaboracion": [
            "Pela el platano y trocealo.",
            "Tritura el platano con la leche y la avena hasta obtener un batido homogeneo.",
            "Sirve al momento.",
        ],
    },
    {
        "id": "D007", "nombre": "Queso fresco con miel, fresas y almendras",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 5, "raciones": 1,
        "ingredientes": [
            {"f_id": "1794", "nombre": "Queso fresco de Burgos", "gramos": 125, "casera": "1 tarrina"},
            {"f_id": "2643", "nombre": "Miel", "gramos": 15, "casera": "1 cucharada"},
            {"f_id": "1671", "nombre": "Fresas", "gramos": 100, "casera": "6-7 unidades"},
            {"f_id": "534", "nombre": "Almendras", "gramos": 15, "casera": "10 unidades"},
        ],
        "elaboracion": [
            "Pon el queso fresco en un bol.",
            "Lava y trocea las fresas y añadelas.",
            "Riega con la miel y termina con las almendras troceadas.",
        ],
    },
    {
        "id": "D008", "nombre": "Tostada de aguacate con huevo cocido",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 12, "raciones": 1,
        "ingredientes": [
            {"f_id": "2163", "nombre": "Pan integral", "gramos": 60, "casera": "2 rebanadas"},
            {"f_id": "1623", "nombre": "Aguacate", "gramos": 75, "casera": "1/2 unidad"},
            {"f_id": "2126", "nombre": "Huevo cocido", "gramos": 60, "casera": "1 unidad"},
            {"f_id": "2544", "nombre": "Aceite de oliva virgen extra", "gramos": 3, "casera": "unas gotas"},
        ],
        "elaboracion": [
            "Cuece el huevo 10 min, enfrialo, pelalo y cortalo en rodajas.",
            "Tuesta el pan.",
            "Machaca el aguacate con una pizca de sal y untalo sobre las tostadas.",
            "Coloca las rodajas de huevo y riega con unas gotas de aceite.",
        ],
    },
    {
        "id": "D009", "nombre": "Bol de yogur con muesli y kiwi",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 5, "raciones": 1,
        "ingredientes": [
            {"f_id": "953", "nombre": "Yogur natural", "gramos": 125, "casera": "1 unidad"},
            {"f_id": "2065", "nombre": "Muesli", "gramos": 40, "casera": "4 cucharadas"},
            {"f_id": "1689", "nombre": "Kiwi", "gramos": 100, "casera": "1 unidad"},
        ],
        "elaboracion": [
            "Pon el yogur en un bol.",
            "Añade el muesli.",
            "Pela el kiwi, cortalo en rodajas y colocalo por encima.",
        ],
    },
    {
        "id": "D010", "nombre": "Revuelto de claras con espinacas y pan integral",
        "tipo": "desayuno", "dificultad": "facil", "tiempo_min": 10, "raciones": 1,
        "ingredientes": [
            {"f_id": "1173", "nombre": "Claras de huevo", "gramos": 120, "casera": "4 claras"},
            {"f_id": "2395", "nombre": "Espinacas", "gramos": 100, "casera": "2 puñados"},
            {"f_id": "2544", "nombre": "Aceite de oliva virgen extra", "gramos": 5, "casera": "1/2 cucharada"},
            {"f_id": "2163", "nombre": "Pan integral", "gramos": 40, "casera": "1 rebanada"},
        ],
        "elaboracion": [
            "Saltea las espinacas en la sarten con el aceite hasta que pierdan el agua.",
            "Añade las claras y remueve a fuego medio hasta cuajar.",
            "Salpimienta y acompaña con el pan tostado.",
        ],
    },
]
