# -*- coding: utf-8 -*-
"""
Descarga USDA FoodData Central (SR Legacy) y extrae solo lo que necesitamos:
cobre, manganeso, ácido pantoténico y azúcares totales de cada alimento.

Se ejecuta una sola vez; deja datos_usda/usda_sr_legacy.json (~1 MB) en el
repositorio para que la fusión no dependa de volver a bajar 36 MB de CSV.

    python datos_usda/extraer_usda.py
"""
import csv, io, json, os, sys, zipfile, urllib.request, collections

BASE = os.path.dirname(os.path.abspath(__file__))
URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
ZIP = os.path.join(BASE, "sr_legacy.zip")
OUT = os.path.join(BASE, "usda_sr_legacy.json")

sys.path.insert(0, BASE)
from correspondencias import NUTRIENTES_USDA

POR_ID = {nid: clave for clave, (nid, _n, _u) in NUTRIENTES_USDA.items()}


def descargar():
    if os.path.exists(ZIP):
        print("Ya descargado:", ZIP)
        return
    print("Descargando USDA SR Legacy (~6 MB)...")
    urllib.request.urlretrieve(URL, ZIP)
    print("OK")


def extraer():
    z = zipfile.ZipFile(ZIP)
    raiz = [n for n in z.namelist() if n.endswith("food.csv")][0].rsplit("/", 1)[0] + "/"

    desc = {}
    with z.open(raiz + "food.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
            if r["data_type"] == "sr_legacy_food":
                desc[r["fdc_id"]] = r["description"]

    vals = collections.defaultdict(dict)
    with z.open(raiz + "food_nutrient.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
            clave = POR_ID.get(int(r["nutrient_id"])) if r["nutrient_id"].isdigit() else None
            if clave and r["fdc_id"] in desc:
                try:
                    vals[r["fdc_id"]][clave] = float(r["amount"])
                except (ValueError, TypeError):
                    pass

    out = {fid: {"desc": desc[fid], "nut": v} for fid, v in vals.items() if v}
    json.dump(out, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{len(out)} alimentos USDA -> {OUT}")


if __name__ == "__main__":
    descargar()
    extraer()
