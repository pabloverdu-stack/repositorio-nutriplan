# -*- coding: utf-8 -*-
"""Generador del PDF del plan semanal (diseño de marca NutriPlan).
Uso:  python pdf_plan/generar_pdf.py
Genera pdf_plan/plan.html y pdf_plan/plan.pdf (vía Chrome headless).

Estructura del PDF:
  1) Portada + recuadro semanal (rejilla 7 días x comidas)
  2) Un bloque por día: cada comida con cantidades, ingredientes y elaboración
"""
import json, os, subprocess, shutil, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)

MARCA = "NutriPlan"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

DIAS = [("lunes", "Lunes"), ("martes", "Martes"), ("miercoles", "Miércoles"), ("jueves", "Jueves"),
        ("viernes", "Viernes"), ("sabado", "Sábado"), ("domingo", "Domingo")]


# ---------------------------------------------------------------- datos demo
def plan_demo():
    """Construye un plan de ejemplo con recetas reales del recetario."""
    rec = json.load(open(os.path.join(ROOT, "recetario.json"), encoding="utf-8"))["recetas"]
    por_id = {r["id"]: r for r in rec}
    by_tipo = {}
    for r in rec:
        by_tipo.setdefault(r["tipo"], []).append(r)

    def pick(tipo, i, kmin=0, kmax=9999):
        cands = [r for r in by_tipo[tipo] if kmin <= r["nutricion"]["energia_kcal"] <= kmax and len(r["ingredientes"]) >= 3]
        return cands[i % len(cands)]

    comidas = [
        {"key": "desayuno", "label": "Desayuno", "tipo": "desayuno"},
        {"key": "media_manana", "label": "Media mañana", "tipo": "merienda"},
        {"key": "comida", "label": "Comida", "tipo": "comida_cena"},
        {"key": "merienda", "label": "Merienda", "tipo": "merienda"},
        {"key": "cena", "label": "Cena", "tipo": "comida_cena"},
    ]
    dias = {}
    n = 0
    for di, (dk, _) in enumerate(DIAS):
        dias[dk] = {}
        for c in comidas:
            kmin, kmax = (300, 520) if c["tipo"] != "merienda" else (120, 300)
            if c["key"] == "comida":
                kmin, kmax = 450, 700
            r = pick(c["tipo"], n * 7 + di * 3, kmin, kmax)
            dias[dk][c["key"]] = {"kind": "receta", "refId": r["id"]}
            n += 1
    return {
        "nombre": "Plan Agosto 2026",
        "comidas": comidas,
        "dias": dias,
    }, por_id


PACIENTE = {"nombre": "María López García", "objetivo": "Pérdida de grasa", "kcal_objetivo": 2000}
NUTRI = {"nombre": "Pablo Verdú", "titulo": "Dietista-Nutricionista", "contacto": "pabloverdu@hotmail.es"}


# ---------------------------------------------------------------- utilidades
def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def comida_de(slot, por_id):
    """Devuelve dict normalizado {nombre, nutricion, ingredientes, elaboracion}"""
    if not slot:
        return None
    if slot.get("kind") == "alimentos":
        return {"nombre": slot.get("nombre", "Alimentos"), "nutricion": slot["nutricion"],
                "ingredientes": slot["ingredientes"], "elaboracion": ["Pesa cada alimento y combínalos."]}
    r = por_id.get(slot["refId"])
    if not r:
        return None
    if slot.get("custom"):
        return {"nombre": r["nombre"], "nutricion": slot["custom"]["nutricion"],
                "ingredientes": slot["custom"]["ingredientes"], "elaboracion": r["elaboracion"]}
    return {"nombre": r["nombre"], "nutricion": r["nutricion"],
            "ingredientes": r["ingredientes"], "elaboracion": r["elaboracion"]}


def k(v):
    return f"{round(v):,}".replace(",", ".")


def macro_barra(n):
    h, p, g = n.get("hidratos_g", 0) * 4, n.get("proteinas_g", 0) * 4, n.get("grasas_g", 0) * 9
    t = h + p + g or 1
    return (h / t * 100, p / t * 100, g / t * 100)


# ---------------------------------------------------------------- HTML
def construir_html(plan, pac, por_id):
    comidas = plan["comidas"]

    # ---- totales por día ----
    tot_dia = {}
    for dk, _ in DIAS:
        s = {"energia_kcal": 0, "proteinas_g": 0, "hidratos_g": 0, "grasas_g": 0, "fibra_g": 0}
        for c in comidas:
            cm = comida_de(plan["dias"][dk].get(c["key"]), por_id)
            if cm:
                for key in s:
                    s[key] += cm["nutricion"].get(key, 0)
        tot_dia[dk] = s
    media = sum(tot_dia[d]["energia_kcal"] for d, _ in DIAS) / 7

    # ---- rejilla semanal ----
    filas = []
    for c in comidas:
        celdas = []
        for dk, _ in DIAS:
            cm = comida_de(plan["dias"][dk].get(c["key"]), por_id)
            if cm:
                celdas.append(
                    f'<td><div class="g-nom">{esc(cm["nombre"])}</div>'
                    f'<div class="g-k">{k(cm["nutricion"]["energia_kcal"])} kcal</div></td>')
            else:
                celdas.append('<td class="g-vacio">—</td>')
        filas.append(f'<tr><th class="g-lbl">{esc(c["label"])}</th>{"".join(celdas)}</tr>')
    fila_tot = "".join(f'<td class="g-tot"><b>{k(tot_dia[dk]["energia_kcal"])}</b><span>kcal</span></td>' for dk, _ in DIAS)
    filas.append(f'<tr class="g-total"><th class="g-lbl">Total día</th>{fila_tot}</tr>')

    cab = "".join(f"<th>{esc(lbl)}</th>" for _, lbl in DIAS)
    rejilla = f'<table class="grid"><thead><tr><th></th>{cab}</tr></thead><tbody>{"".join(filas)}</tbody></table>'

    # ---- páginas por día ----
    dias_html = []
    for dk, dlbl in DIAS:
        t = tot_dia[dk]
        ph, pp, pg = macro_barra(t)
        bloques = []
        for c in comidas:
            cm = comida_de(plan["dias"][dk].get(c["key"]), por_id)
            if not cm:
                continue
            ings = "".join(
                f'<li><span class="i-n">{esc(i["nombre"])}'
                + (f' <em>· {esc(i["casera"])}</em>' if i.get("casera") else "")
                + f'</span><span class="i-g">{i["gramos"]} g</span></li>'
                for i in cm["ingredientes"])
            pasos = "".join(f"<li>{esc(p)}</li>" for p in cm["elaboracion"])
            n = cm["nutricion"]
            bloques.append(f"""
      <section class="meal">
        <div class="meal-head">
          <span class="meal-tag">{esc(c["label"])}</span>
          <h3>{esc(cm["nombre"])}</h3>
          <span class="meal-kcal">{k(n["energia_kcal"])} kcal</span>
        </div>
        <div class="meal-macros">
          <span class="mm"><i class="d-h"></i>Hidratos <b>{n.get("hidratos_g",0):.0f} g</b></span>
          <span class="mm"><i class="d-p"></i>Proteínas <b>{n.get("proteinas_g",0):.0f} g</b></span>
          <span class="mm"><i class="d-g"></i>Grasas <b>{n.get("grasas_g",0):.0f} g</b></span>
          <span class="mm"><i class="d-f"></i>Fibra <b>{n.get("fibra_g",0):.0f} g</b></span>
        </div>
        <div class="meal-body">
          <div class="col-ing">
            <h4>Ingredientes</h4>
            <ul class="ings">{ings}</ul>
          </div>
          <div class="col-elab">
            <h4>Elaboración</h4>
            <ol class="pasos">{pasos}</ol>
          </div>
        </div>
      </section>""")

        dias_html.append(f"""
  <div class="page day-page">
    <div class="day-head">
      <div class="day-title"><span class="day-dot"></span><h2>{esc(dlbl)}</h2></div>
      <div class="day-sum">
        <div class="ds-k"><b>{k(t["energia_kcal"])}</b> kcal</div>
        <div class="ds-bar"><i style="width:{ph:.1f}%" class="b-h"></i><i style="width:{pp:.1f}%" class="b-p"></i><i style="width:{pg:.1f}%" class="b-g"></i></div>
        <div class="ds-m">H {t["hidratos_g"]:.0f} g · P {t["proteinas_g"]:.0f} g · G {t["grasas_g"]:.0f} g</div>
      </div>
    </div>
    {"".join(bloques)}
  </div>""")

    return PLANTILLA.format(
        marca=MARCA, plan=esc(plan["nombre"]), pac=esc(pac["nombre"]),
        objetivo=esc(pac["objetivo"]), kcal_obj=k(pac["kcal_objetivo"]), media=k(media),
        nutri=esc(NUTRI["nombre"]), nutri_tit=esc(NUTRI["titulo"]), nutri_con=esc(NUTRI["contacto"]),
        n_comidas=len(comidas), rejilla=rejilla, dias="".join(dias_html), css=CSS)


CSS = """
/* ===== Tema OSCURO fiel a la app · alto contraste ===== */
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { background: #0b0d12; }
body {
  margin: 0; font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
  color: #f0f4f9; font-size: 10.5pt; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1,h2,h3,h4 { margin: 0; font-weight: 700; letter-spacing: -.01em; }
.page { width: 210mm; padding: 13mm 12mm 12mm; background: #0b0d12; position: relative; }
/* La portada ocupa una página completa; los días fluyen para no dejar huecos */
.page.cover { min-height: 297mm; page-break-after: always; }
.day-page { padding-top: 6mm; }

/* ---------- Portada ---------- */
.cover-band {
  background: linear-gradient(135deg, #16202b 0%, #14312a 60%, #14453a 100%);
  border: 1px solid #2f3a48; border-radius: 16px; padding: 24px 26px; margin-bottom: 20px;
  display: flex; justify-content: space-between; align-items: flex-start;
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo {
  width: 42px; height: 42px; border-radius: 12px; background: #5fd0a6; color: #04231a;
  display: flex; align-items: center; justify-content: center; font-size: 23px; font-weight: 800;
}
.brand-name { font-size: 17pt; font-weight: 800; letter-spacing: -.02em; color: #ffffff; }
.brand-sub { font-size: 8.5pt; color: #9fd9c4; margin-top: 2px; }
.cover-meta { text-align: right; }
.cover-meta .plan-name { font-size: 14pt; font-weight: 800; color: #5fd0a6; }
.cover-meta .pac { font-size: 11.5pt; margin-top: 3px; color: #ffffff; font-weight: 600; }
.cover-meta .obj { font-size: 9pt; color: #b9c4d2; margin-top: 4px; }

.kpis { display: flex; gap: 11px; margin-bottom: 20px; }
.kpi { flex: 1; border: 1px solid #2a3341; border-radius: 12px; padding: 12px 14px; background: #161c26; }
.kpi b { display: block; font-size: 17pt; color: #5fd0a6; line-height: 1.1; }
.kpi span { font-size: 7.8pt; color: #9aa7b8; text-transform: uppercase; letter-spacing: .07em; }

/* ---------- Rejilla semanal ---------- */
.sec-title { font-size: 12pt; margin: 0 0 11px; display: flex; align-items: center; gap: 9px; color: #ffffff; }
.sec-title::before { content: ""; width: 4px; height: 16px; background: #5fd0a6; border-radius: 3px; }
.grid { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8.2pt; table-layout: fixed; }
.grid th, .grid td { border: 1px solid #2a3341; padding: 7px 7px; vertical-align: top; background: #12171f; }
.grid thead th {
  background: #5fd0a6; color: #04231a; font-size: 9pt; font-weight: 800; text-align: center;
  padding: 8px 4px; border-color: #5fd0a6; letter-spacing: .02em;
}
.grid thead th:first-child { background: transparent; border-color: transparent; width: 66px; }
.grid th.g-lbl { background: #232d3b; font-size: 8.2pt; color: #ffffff; font-weight: 700; text-align: left; width: 66px; }
.g-nom { font-weight: 600; color: #f0f4f9; line-height: 1.3;
         display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.g-k { color: #5fd0a6; font-weight: 800; margin-top: 3px; font-size: 7.8pt; }
.g-vacio { color: #4a5566; text-align: center; }
.g-total td { background: #1c2430; text-align: center; }
.g-total b { color: #5fd0a6; font-size: 10.5pt; }
.g-total span { color: #9aa7b8; font-size: 7pt; display: block; }

.cover-foot { margin-top: 18px; border-top: 1px solid #2a3341; padding-top: 12px;
  display: flex; justify-content: space-between; font-size: 8.5pt; color: #9aa7b8; }
.cover-foot b { color: #f0f4f9; }
.nota { margin-top: 16px; background: #122b25; border: 1px solid #2f5f4f; border-left: 4px solid #5fd0a6;
  border-radius: 10px; padding: 12px 14px; font-size: 8.8pt; color: #cfe9df; }
.nota b { color: #7ee0bb; }

/* ---------- Páginas de día ---------- */
.day-head { display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(135deg, #16202b, #14352c); border: 1px solid #2f3a48;
  border-radius: 13px; padding: 13px 18px; margin-bottom: 15px;
  page-break-inside: avoid; page-break-after: avoid; }
.day-title { display: flex; align-items: center; gap: 10px; }
.day-dot { width: 10px; height: 10px; border-radius: 50%; background: #5fd0a6; display: inline-block; }
.day-head h2 { font-size: 15pt; color: #ffffff; }
.day-sum { text-align: right; min-width: 175px; }
.ds-k { font-size: 10.5pt; color: #b9c4d2; } .ds-k b { color: #5fd0a6; font-size: 14pt; }
.ds-bar { height: 6px; border-radius: 3px; overflow: hidden; background: #2a3341; display: flex; margin: 5px 0 4px; }
.ds-bar i { display: block; height: 100%; }
.ds-m { font-size: 8pt; color: #b9c4d2; }
.b-h, .d-h { background: #f0c274; } .b-p, .d-p { background: #7bb8ff; }
.b-g, .d-g { background: #f28db2; } .d-f { background: #a8d08d; }

.meal { border: 1px solid #2a3341; border-radius: 13px; margin-bottom: 12px;
  page-break-inside: avoid; overflow: hidden; background: #12171f; }
.meal-head { display: flex; align-items: center; gap: 11px; padding: 11px 15px;
  background: #1c2430; border-bottom: 1px solid #2a3341; }
.meal-tag { background: #5fd0a6; color: #04231a; font-size: 7.5pt; font-weight: 800; padding: 4px 10px;
  border-radius: 20px; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
.meal-head h3 { font-size: 11.5pt; flex: 1; color: #ffffff; }
.meal-kcal { color: #5fd0a6; font-weight: 800; font-size: 11pt; white-space: nowrap; }
.meal-macros { display: flex; gap: 18px; padding: 8px 15px; border-bottom: 1px solid #222a36;
  font-size: 8.4pt; color: #9aa7b8; background: #151b24; }
.mm i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 6px; }
.mm b { color: #f0f4f9; }
.meal-body { display: flex; gap: 0; }
.col-ing { width: 42%; padding: 12px 15px; border-right: 1px solid #222a36; }
.col-elab { width: 58%; padding: 12px 15px; }
.meal-body h4 { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #5fd0a6; margin-bottom: 8px; }
.ings { list-style: none; margin: 0; padding: 0; }
.ings li { display: flex; justify-content: space-between; gap: 9px; padding: 4px 0;
  border-bottom: 1px solid #1f2731; font-size: 9pt; }
.ings li:last-child { border-bottom: none; }
.i-n { color: #e7ecf3; }
.i-n em { color: #98a4b4; font-style: normal; font-size: 8pt; }
.i-g { font-weight: 800; color: #5fd0a6; white-space: nowrap; }
.pasos { margin: 0; padding-left: 16px; font-size: 9pt; color: #dde4ed; }
.pasos li { margin-bottom: 6px; padding-left: 3px; }
.pasos li::marker { color: #5fd0a6; font-weight: 800; }
"""

PLANTILLA = """<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>{plan} · {pac}</title>
<style>{css}</style></head>
<body>
  <div class="page cover">
    <div class="cover-band">
      <div class="brand">
        <div class="logo">&#9681;</div>
        <div><div class="brand-name">{marca}</div><div class="brand-sub">Plan nutricional personalizado</div></div>
      </div>
      <div class="cover-meta">
        <div class="plan-name">{plan}</div>
        <div class="pac">{pac}</div>
        <div class="obj">{objetivo} · objetivo {kcal_obj} kcal/día</div>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><b>{media}</b><span>kcal media / día</span></div>
      <div class="kpi"><b>7</b><span>días planificados</span></div>
      <div class="kpi"><b>{n_comidas}</b><span>comidas al día</span></div>
      <div class="kpi"><b>{kcal_obj}</b><span>objetivo diario</span></div>
    </div>

    <h2 class="sec-title">Tu semana de un vistazo</h2>
    {rejilla}

    <div class="nota">
      <b>Cómo usar tu plan:</b> esta semana se repite durante el mes. En las páginas siguientes tienes
      cada día con las cantidades exactas, los ingredientes y la elaboración de cada comida.
      Si un día no te apetece una comida, consúltame y te paso una alternativa equivalente.
    </div>

    <div class="cover-foot">
      <div><b>{nutri}</b> · {nutri_tit}</div>
      <div>{nutri_con}</div>
    </div>
  </div>
  {dias}
</body></html>
"""


def main():
    plan, por_id = plan_demo()
    html = construir_html(plan, PACIENTE, por_id)
    html_path = os.path.join(BASE, "plan.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML:", html_path)

    pdf_path = os.path.join(BASE, "plan.pdf")
    if os.path.exists(pdf_path):
        try: os.remove(pdf_path)
        except OSError: pass
    chrome = CHROME if os.path.exists(CHROME) else shutil.which("chrome")
    if not chrome:
        print("Chrome no encontrado: abre plan.html e imprime a PDF"); return
    cmd = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}",
           "file:///" + html_path.replace("\\", "/")]
    subprocess.run(cmd, capture_output=True, timeout=120)
    print("PDF:", pdf_path, "OK" if os.path.exists(pdf_path) else "FALLO")


if __name__ == "__main__":
    main()
