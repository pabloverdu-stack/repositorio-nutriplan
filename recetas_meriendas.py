# -*- coding: utf-8 -*-
"""Lote 1 - 10 meriendas."""

def _r(id, nombre, dif, t, ings, pasos):
    return {"id": id, "nombre": nombre, "tipo": "merienda", "dificultad": dif,
            "tiempo_min": t, "raciones": 1,
            "ingredientes": [{"f_id": f, "nombre": nm, "gramos": g, "casera": c} for f, nm, g, c in ings],
            "elaboracion": pasos}

RECETAS = [
 _r("M001","Yogur natural con nueces y miel","facil",3,
    [("953","Yogur natural",125,"1 unidad"),("2201","Nueces",20,"3 nueces"),("2643","Miel",10,"1 cucharadita")],
    ["Pon el yogur en un bol.","Añade las nueces troceadas y la miel."]),
 _r("M002","Tostada integral con crema de cacahuete y platano","facil",5,
    [("2163","Pan integral",40,"1 rebanada"),("539","Crema de cacahuete",20,"1 cucharada"),("1737","Platano",80,"1/2")],
    ["Tuesta el pan.","Unta la crema de cacahuete.","Coloca el platano en rodajas."]),
 _r("M003","Manzana con almendras","facil",2,
    [("2231","Manzana",150,"1 unidad"),("534","Almendras",25,"un puñado")],
    ["Trocea la manzana.","Acompaña con las almendras."]),
 _r("M004","Requeson con arandanos y avena","facil",3,
    [("2517","Requeson",125,"1 tarrina"),("2368","Arandanos",80,"un puñado"),("59","Copos de avena",20,"2 cucharadas")],
    ["Pon el requeson en un bol.","Añade los arandanos y la avena por encima."]),
 _r("M005","Tostada con queso fresco y pavo","facil",5,
    [("2163","Pan integral",40,"1 rebanada"),("1794","Queso fresco de Burgos",40,"unas lonchas"),("1699","Pavo fiambre",40,"2 lonchas")],
    ["Tuesta el pan.","Coloca el queso fresco y el pavo encima."]),
 _r("M006","Yogur griego con fresas y pistachos","facil",4,
    [("118","Yogur griego",125,"1 unidad"),("1671","Fresas",100,"6-7 unidades"),("2207","Pistachos",15,"un puñado")],
    ["Pon el yogur en un bol.","Añade las fresas troceadas y los pistachos."]),
 _r("M007","Batido de leche con platano y cacao","facil",5,
    [("1319","Leche semidesnatada",200,"1 vaso"),("1737","Platano",100,"1 unidad"),("28","Chocolate negro",10,"1 onza")],
    ["Tritura la leche con el platano.","Añade el chocolate rallado y mezcla."]),
 _r("M008","Pan con tomate, aceite y naranja","facil",6,
    [("2163","Pan integral",40,"1 rebanada"),("2544","Aceite de oliva virgen extra",8,"1 cucharada"),
     ("1879","Tomate",60,"1/2"),("2235","Naranja",150,"1 unidad")],
    ["Tuesta el pan y unta el tomate rallado con el aceite.","Acompaña con la naranja pelada."]),
 _r("M009","Bastones de zanahoria y pepino con requeson","facil",5,
    [("1892","Zanahoria",100,"1 unidad"),("1772","Pepino",100,"1/2"),("2517","Requeson",80,"unas cucharadas")],
    ["Corta la zanahoria y el pepino en bastones.","Sirve con el requeson como dip."]),
 _r("M010","Mix de frutos secos y pasas","facil",1,
    [("534","Almendras",15,"un puñado"),("2201","Nueces",15,"2 nueces"),("1633","Avellanas",15,"un puñado"),("1762","Uvas pasas",20,"un puñado")],
    ["Mezcla los frutos secos con las pasas."]),
]
