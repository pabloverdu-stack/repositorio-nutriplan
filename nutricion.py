# -*- coding: utf-8 -*-
"""
Motor de nutricion del recetario.
- Carga la base BEDCA (datos_bedca/bedca_raw.json)
- Normaliza cada alimento a claves de nutrientes estandar por 100 g
- Calcula la ficha nutricional de una receta a partir de ingredientes {f_id, gramos}
La energia (kcal) se calcula por Atwater desde los macros (consistente y siempre disponible).
"""
import json, os, unicodedata

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _sinacentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower())
                   if unicodedata.category(c) != "Mn")
RAW = os.path.join(BASE_DIR, "datos_bedca", "bedca_raw.json")

# c_id BEDCA -> (clave_estandar, factor). factor aplica al valor por 100 g.
MAP = {
    "416": ("proteinas_g", 1), "410": ("grasas_g", 1), "299": ("sat_g", 1),
    "282": ("mono_g", 1), "287": ("poli_g", 1), "433": ("colesterol_mg", 1),
    "53": ("hidratos_g", 1), "446": ("azucares_g", 1), "307": ("fibra_g", 1),
    "417": ("agua_g", 1), "404": ("alcohol_g", 1),
    "317": ("calcio_mg", 1), "319": ("hierro_mg", 1), "322": ("magnesio_mg", 1),
    "326": ("fosforo_mg", 1), "321": ("potasio_mg", 1), "323": ("sodio_mg", 1),
    "464": ("zinc_mg", 1), "453": ("cobre_mg", 0.001), "457": ("manganeso_mg", 1),
    "462": ("selenio_ug", 1), "456": ("yodo_ug", 1),
    "100": ("vit_a_ug", 1), "102": ("vit_d_ug", 1), "103": ("vit_e_mg", 1),
    "486": ("vit_c_mg", 1), "483": ("tiamina_mg", 1), "482": ("riboflavina_mg", 1),
    "475": ("niacina_mg", 1), "478": ("pantotenico_mg", 1), "485": ("vit_b6_mg", 1),
    "468": ("biotina_ug", 1), "472": ("folato_ug", 1), "484": ("vit_b12_ug", 1),
}
FOLATO_FALLBACK = "487"  # acido folico, si falta folato total (472)

# orden y etiqueta legible de cada nutriente para exportar
NUTRIENTES = [
    ("energia_kcal", "Energia (kcal)"),
    ("proteinas_g", "Proteinas (g)"), ("grasas_g", "Grasas (g)"),
    ("sat_g", "Grasas saturadas (g)"), ("mono_g", "Grasas monoinsat. (g)"),
    ("poli_g", "Grasas poliinsat. (g)"), ("colesterol_mg", "Colesterol (mg)"),
    ("hidratos_g", "Hidratos (g)"), ("azucares_g", "Azucares (g)"), ("fibra_g", "Fibra (g)"),
    ("agua_g", "Agua (g)"),
    ("calcio_mg", "Calcio (mg)"), ("hierro_mg", "Hierro (mg)"), ("magnesio_mg", "Magnesio (mg)"),
    ("fosforo_mg", "Fosforo (mg)"), ("potasio_mg", "Potasio (mg)"), ("sodio_mg", "Sodio (mg)"),
    ("zinc_mg", "Zinc (mg)"), ("cobre_mg", "Cobre (mg)"), ("manganeso_mg", "Manganeso (mg)"),
    ("selenio_ug", "Selenio (ug)"), ("yodo_ug", "Yodo (ug)"),
    ("vit_a_ug", "Vitamina A (ug)"), ("vit_d_ug", "Vitamina D (ug)"), ("vit_e_mg", "Vitamina E (mg)"),
    ("vit_c_mg", "Vitamina C (mg)"), ("tiamina_mg", "Tiamina B1 (mg)"),
    ("riboflavina_mg", "Riboflavina B2 (mg)"), ("niacina_mg", "Niacina B3 (mg)"),
    ("pantotenico_mg", "Ac. pantotenico B5 (mg)"), ("vit_b6_mg", "Vitamina B6 (mg)"),
    ("biotina_ug", "Biotina B8 (ug)"), ("folato_ug", "Folato (ug)"), ("vit_b12_ug", "Vitamina B12 (ug)"),
]
CLAVES = [k for k, _ in NUTRIENTES]


def _num(v):
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in ("", "traza", "trace", "nd", "n/d"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def cargar_catalogo():
    data = json.load(open(RAW, encoding="utf-8-sig"))
    cat = {}
    for f in data:
        comp = f.get("comp") or {}
        nut = {}
        for cid, info in comp.items():
            if cid in MAP:
                clave, factor = MAP[cid]
                val = _num(info.get("value"))
                if val is not None:
                    nut[clave] = val * factor
        # folato fallback
        if "folato_ug" not in nut and FOLATO_FALLBACK in comp:
            v = _num(comp[FOLATO_FALLBACK].get("value"))
            if v is not None:
                nut["folato_ug"] = v
        # energia Atwater desde macros
        prot = nut.get("proteinas_g", 0); hc = nut.get("hidratos_g", 0)
        gra = nut.get("grasas_g", 0); fib = nut.get("fibra_g", 0)
        alc = nut.get("alcohol_g", 0)
        nut["energia_kcal"] = round(prot * 4 + hc * 4 + gra * 9 + fib * 2 + alc * 7, 1)
        cat[f["f_id"]] = {"nombre": f["nombre_es"], "nombre_en": f.get("nombre_en", ""), "nut": nut}
    return cat


def buscar(cat, texto, limite=25):
    t = _sinacentos(texto)
    res = [(fid, v["nombre"]) for fid, v in cat.items() if t in _sinacentos(v["nombre"])]
    res.sort(key=lambda x: (len(x[1]), x[1]))
    return res[:limite]


# formas de procesado/presentacion que NO queremos por defecto (se penalizan
# salvo que la propia busqueda las pida explicitamente)
_MALAS = ["frito", "frita", "asado", "asada", "rebozad", "conserva", "escabeche",
          "almibar", "salmuera", "desecad", "deshidratad", "en polvo", "condensada",
          "evaporada", "congelad", "azucar", "mermelada", "confitura", "zumo",
          "nectar", "batido", "pastel", "mousse", "pure", "salsa", "tostado",
          "enlatad", "isabel", "generico", "s/e", "light", "diet"]


def mejor(cat, termino, mincomp=8):
    """Devuelve (f_id, nombre) del alimento mas adecuado cuyo nombre contiene el termino.
    Prefiere formas al natural/crudas (penaliza fritos, asados, conserva, almibar, polvo...)
    salvo que el propio termino las pida. Desempata por nº de nutrientes."""
    t = _sinacentos(termino)
    malas = [m for m in _MALAS if m not in t]
    cands = []
    for fid, v in cat.items():
        nom = _sinacentos(v["nombre"])
        if t in nom and len(v["nut"]) >= mincomp:
            pen = sum(1 for m in malas if m in nom)
            bonus = 0 if ("crudo" in nom or "fresco" in nom or "fresca" in nom) else 1
            empieza = 0 if nom.startswith(t) else 1
            cands.append((pen, empieza, bonus, -len(v["nut"]), len(v["nombre"]), fid, v["nombre"]))
    if not cands:
        return None
    cands.sort()
    return (cands[0][5], cands[0][6])


def calcular(cat, ingredientes):
    """ingredientes: lista de dict {f_id, g}. Devuelve totales + faltantes."""
    tot = {k: 0.0 for k in CLAVES}
    faltan = set()
    for ing in ingredientes:
        a = cat.get(str(ing["f_id"]))
        if not a:
            raise KeyError(f"f_id no encontrado: {ing['f_id']}")
        factor = ing["g"] / 100.0
        for k in CLAVES:
            if k in a["nut"]:
                tot[k] += a["nut"][k] * factor
            else:
                faltan.add(k)
    tot = {k: round(v, 2) for k, v in tot.items()}
    return tot, sorted(faltan)


if __name__ == "__main__":
    cat = cargar_catalogo()
    print("Catalogo:", len(cat), "alimentos")
    # guardar catalogo normalizado
    out = os.path.join(BASE_DIR, "datos_bedca", "catalogo.json")
    json.dump(cat, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print("Guardado", out)
