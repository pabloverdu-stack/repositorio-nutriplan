# -*- coding: utf-8 -*-
"""Generador combinatorio de recetas coherentes (formato por clave canonica).
Construye POOLS finitos por plantilla y los intercala -> nunca hay bucle infinito.
RECETAS = 240 desayunos + 520 comidas/cenas + 240 meriendas = 1000."""
import ingredientes as I

D = I.display

CARNE = ['pollo_pechuga', 'pavo_pechuga', 'cerdo_lomo', 'cerdo_solomillo', 'vacuno_solomillo']
PESCADO = ['merluza', 'salmon', 'bacalao', 'dorada', 'lubina', 'trucha', 'lenguado', 'gallo', 'rape', 'caballa', 'bonito', 'atun_fresco']
MARISCO = ['gamba', 'sepia', 'calamar', 'pulpo']
LEGUMBRE = ['lenteja_cocida', 'garbanzo_cocido', 'alubia_blanca']
BASES = ['arroz_blanco', 'arroz_integral', 'patata', 'pasta', 'quinoa', 'boniato']
VERDURAS = ['brocoli', 'judia_verde', 'espinaca', 'calabacin', 'pimiento', 'zanahoria',
            'champinon', 'esparrago', 'coliflor', 'guisante', 'calabaza', 'acelga',
            'puerro', 'setas', 'berenjena', 'ensalada']
VAPOR = {'brocoli', 'judia_verde', 'guisante', 'esparrago', 'coliflor'}
REHOGAR = {'espinaca', 'acelga'}
GRAMOS_BASE = {'arroz_blanco': 70, 'arroz_integral': 70, 'pasta': 80, 'quinoa': 65, 'patata': 150, 'boniato': 150}
CASERA_BASE = {'arroz_blanco': 'en crudo', 'arroz_integral': 'en crudo', 'pasta': 'en crudo',
               'quinoa': '1/2 vaso', 'patata': '1 mediana', 'boniato': '1 unidad'}
PROT_GRAMOS = {**{p: 150 for p in CARNE}, **{p: 170 for p in PESCADO}, **{p: 160 for p in MARISCO}, 'tofu': 150, 'huevo': 120}
PROT_CASERA = {'huevo': '2 unidades', 'tofu': '1/2 bloque'}


def R(id, nombre, tipo, ings, pasos, dif="facil", t=30):
    return {"id": id, "nombre": nombre, "tipo": tipo, "dificultad": dif, "tiempo_min": t,
            "raciones": 1, "_ings_clave": ings, "elaboracion": pasos}


def _intercalar(pools):
    """Round-robin sobre varias listas ya materializadas (equilibra variedad)."""
    out, i = [], 0
    while any(i < len(p) for p in pools):
        for p in pools:
            if i < len(p):
                out.append(p[i])
        i += 1
    return out


def _base_paso(b):
    return {'arroz_blanco': 'Cuece el arroz.', 'arroz_integral': 'Cuece el arroz integral.',
            'pasta': 'Cuece la pasta.', 'quinoa': 'Cuece la quinoa.',
            'patata': 'Cuece o asa la patata.', 'boniato': 'Asa el boniato.'}[b]


def _verd(v):
    if v == 'ensalada':
        return [('lechuga', 50, 'unas hojas'), ('tomate', 60, '1/2'), ('cebolla', 20, '1/4')], "Prepara una ensalada de lechuga, tomate y cebolla."
    g = 150 if v in ('brocoli', 'coliflor') else (120 if v in REHOGAR else 130)
    n = D(v).lower()
    paso = f"Cuece al vapor {n}." if v in VAPOR else (f"Rehoga {n}." if v in REHOGAR else f"Saltea {n}.")
    return [(v, g, 'al gusto')], paso


def _prot_paso(p):
    n = D(p).lower()
    if p in CARNE:
        return f"Haz {n} a la plancha, salpimentado."
    if p in PESCADO:
        return f"Haz {n} a la plancha o al horno."
    if p in MARISCO:
        return f"Saltea {n} con un diente de ajo."
    if p == 'tofu':
        return "Dora el tofu en dados."
    return "Cuaja los huevos a la plancha."


def _pool_comidas():
    prots = CARNE + PESCADO + MARISCO + ['tofu', 'huevo']
    # pools separados por eje proteina para intercalar y variar
    por_prot = []
    for p in prots:
        lst = []
        for v in VERDURAS:
            for b in BASES:
                vings, vpaso = _verd(v)
                ings = [(p, PROT_GRAMOS[p], PROT_CASERA.get(p, '1 racion')),
                        (b, GRAMOS_BASE[b], CASERA_BASE[b])] + vings + [('aceite_oliva', 10, '1 cucharada')]
                tec = 'salteado' if p == 'tofu' else ('a la plancha' if p in (CARNE + PESCADO + MARISCO) else '')
                vnom = 'ensalada' if v == 'ensalada' else D(v).lower()
                nombre = (f"{D(p)} {tec} con {D(b).lower()} y {vnom}").replace("  ", " ").strip()
                pasos = [_base_paso(b), vpaso, _prot_paso(p), "Sirve todo junto y aliña con el aceite de oliva."]
                lst.append((nombre, ings, pasos))
        por_prot.append(lst)
    pbv = _intercalar(por_prot)
    # legumbres
    verd_leg = ['espinaca', 'zanahoria', 'acelga', 'calabaza', 'pimiento', 'champinon', 'puerro',
                'calabacin', 'berenjena', 'setas', 'judia_verde', 'brocoli', 'coliflor', 'esparrago', 'guisante']
    leg = []
    for v in verd_leg:
        for lg in LEGUMBRE:
            ings = [(lg, 180, '1 plato'), (v, 120, 'al gusto'), ('cebolla', 30, '1/4'),
                    ('tomate', 60, '1/2'), ('aceite_oliva', 10, '1 cucharada')]
            nombre = f"{D(lg)} con {D(v).lower()}"
            pasos = ["Pocha la cebolla y el tomate en el aceite.", f"Añade {D(v).lower()} y rehoga.",
                     f"Incorpora {D(lg).lower()} y guisa 10 min."]
            leg.append((nombre, ings, pasos))
    return _intercalar([pbv, leg])  # mezcla legumbres a lo largo del listado


def _pool_desayunos():
    yogures = ['yogur_natural', 'yogur_griego']
    cereales = ['avena', 'muesli']
    frutas = ['platano', 'manzana', 'naranja', 'pera', 'kiwi', 'fresa', 'arandano', 'uva',
              'mandarina', 'melocoton', 'mango', 'cereza', 'frambuesa', 'higo', 'ciruela', 'melon', 'sandia']
    secos = ['nuez', 'almendra', 'avellana', 'pistacho', 'anacardo', 'cacahuete', 'pasas', 'datil']
    panes = ['pan_integral', 'pan_centeno']
    top_dulce = [('crema_cacahuete', 20, '1 cucharada'), ('requeson', 70, 'unas cucharadas')]
    top_salado = [('aguacate', 70, '1/2'), ('pavo_fiambre', 40, '2 lonchas'),
                  ('jamon_serrano', 30, '1 loncha'), ('queso_fresco', 50, 'unas lonchas'), ('jamon_cocido', 40, '2 lonchas')]
    bowl = []
    for f in frutas:
        for y in yogures:
            for c in cereales:
                for s in secos:
                    ings = [(y, 125, '1 unidad'), (c, 35, '3 cucharadas'), (f, 100, '1 racion'), (s, 15, 'un puñado')]
                    nombre = f"Bowl de {D(y).lower()} con {D(f).lower()} y {D(s).lower()}"
                    pasos = [f"Pon {D(y).lower()} en un bol.", f"Añade {D(c).lower()} y {D(f).lower()} troceado.", f"Termina con {D(s).lower()}."]
                    bowl.append((nombre, ings, pasos))
    tost = []
    for f in frutas:
        for pan in panes:
            for t in top_dulce:
                ings = [(pan, 60, '2 rebanadas'), t, (f, 80, '1 racion')]
                nombre = f"Tostada de {D(pan).lower()} con {D(t[0]).lower()} y {D(f).lower()}"
                pasos = ["Tuesta el pan.", f"Unta {D(t[0]).lower()} y añade {D(f).lower()}."]
                tost.append((nombre, ings, pasos))
    for pan in panes:
        for t in top_salado:
            ings = [(pan, 60, '2 rebanadas'), t, ('tomate', 60, '1/2')]
            nombre = f"Tostada de {D(pan).lower()} con {D(t[0]).lower()} y tomate"
            pasos = ["Tuesta el pan.", f"Añade {D(t[0]).lower()} y el tomate."]
            tost.append((nombre, ings, pasos))
    porr = []
    for base in ('avena', 'quinoa'):
        for f in frutas:
            g = (50, '5 cucharadas') if base == 'avena' else (50, '1/2 vaso')
            ings = [(base, g[0], g[1]), ('leche_semi', 200, '1 vaso'), (f, 100, '1 racion'), ('canela', 1, '1 pizca')]
            nombre = f"Porridge de {D(base).lower()} con {D(f).lower()} y canela"
            pasos = ["Cuece con la leche unos minutos.", f"Añade {D(f).lower()} troceado y la canela."]
            porr.append((nombre, ings, pasos))
    bat = []
    for basel, gl, nl in (('leche_semi', 200, '1 vaso'), ('yogur_natural', 125, '1 yogur')):
        for f in frutas:
            ings = [(basel, gl, nl), (f, 100, '1 racion'), ('avena', 20, '2 cucharadas')]
            nombre = f"Batido de {D(basel).lower()}, {D(f).lower()} y avena"
            pasos = [f"Tritura con {D(f).lower()} y la avena hasta que quede cremoso."]
            bat.append((nombre, ings, pasos))
    huevos = []
    extras = [('champinon', 80, '4 unidades'), ('espinaca', 80, '1 puñado'), ('tomate', 80, '1/2'),
              ('pavo_fiambre', 40, '2 lonchas'), ('jamon_serrano', 30, '1 loncha'),
              ('jamon_cocido', 40, '2 lonchas'), ('queso_fresco', 40, 'un poco')]
    for prot, pg, pc in (('huevo', 120, '2 unidades'), ('clara', 120, '4 claras')):
        for ex in extras:
            ings = [(prot, pg, pc), ex, ('pan_integral', 40, '1 rebanada'), ('aceite_oliva', 6, '1/2 cucharada')]
            nombre = f"Revuelto de {D(prot).lower()} con {D(ex[0]).lower()}"
            pasos = [f"Saltea {D(ex[0]).lower()}.", f"Añade {D(prot).lower()} y cuaja.", "Sirve con el pan."]
            huevos.append((nombre, ings, pasos))
    return _intercalar([bowl, tost, porr, bat, huevos])


def _pool_meriendas():
    frutas = ['platano', 'manzana', 'naranja', 'pera', 'kiwi', 'fresa', 'arandano', 'uva',
              'mandarina', 'melocoton', 'mango', 'cereza', 'higo', 'ciruela', 'melon', 'sandia', 'frambuesa']
    secos = ['nuez', 'almendra', 'avellana', 'pistacho', 'anacardo', 'cacahuete', 'pasas', 'datil']
    yogures = ['yogur_natural', 'yogur_griego']
    lacteos = ['requeson', 'queso_fresco']
    panes = ['pan_integral', 'pan_centeno']
    top = [('crema_cacahuete', 20, '1 cucharada'), ('requeson', 70, 'unas cucharadas'),
           ('queso_fresco', 50, 'unas lonchas'), ('aguacate', 60, '1/2')]
    fs = []
    for f in frutas:
        for s in secos:
            ings = [(f, 150, '1 racion'), (s, 20, 'un puñado')]
            fs.append((f"{D(f)} con {D(s).lower()}", ings, [f"Sirve {D(f).lower()} con {D(s).lower()}."]))
    yf = []
    for f in frutas:
        for y in yogures:
            for s in secos:
                ings = [(y, 125, '1 unidad'), (f, 90, '1 racion'), (s, 15, 'un puñado')]
                yf.append((f"{D(y)} con {D(f).lower()} y {D(s).lower()}", ings,
                           [f"Pon {D(y).lower()} en un bol.", f"Añade {D(f).lower()} y {D(s).lower()}."]))
    lf = []
    for f in frutas:
        for lac in lacteos:
            ings = [(lac, 100, '1 racion'), (f, 100, '1 racion'), ('miel', 8, '1 cucharadita')]
            lf.append((f"{D(lac)} con {D(f).lower()} y miel", ings,
                       [f"Pon {D(lac).lower()} en un bol.", f"Añade {D(f).lower()} troceado y la miel."]))
    tost = []
    for pan in panes:
        for t in top:
            ings = [(pan, 40, '1 rebanada'), t]
            tost.append((f"Tostada de {D(pan).lower()} con {D(t[0]).lower()}", ings,
                         ["Tuesta el pan.", f"Añade {D(t[0]).lower()}."]))
    fls = []  # fruta + lacteo + fruto seco
    for f in frutas:
        for lac in lacteos:
            for s in secos:
                ings = [(lac, 100, '1 racion'), (f, 90, '1 racion'), (s, 15, 'un puñado')]
                fls.append((f"{D(lac)} con {D(f).lower()} y {D(s).lower()}", ings,
                            [f"Pon {D(lac).lower()} en un bol.", f"Añade {D(f).lower()} y {D(s).lower()}."]))
    bat = []  # batido de merienda
    for f in frutas:
        ings = [('leche_semi', 200, '1 vaso'), (f, 100, '1 racion')]
        bat.append((f"Batido de leche y {D(f).lower()}", ings,
                    [f"Tritura la leche con {D(f).lower()}."]))
    return _intercalar([fs, yf, lf, tost, fls, bat])


def _construir(pool, n, tipo, prefijo):
    out = []
    for nombre, ings, pasos in pool[:n]:
        rid = f"{prefijo}{len(out)+1:04d}"
        t = 8 if tipo == "desayuno" else (4 if tipo == "merienda" else 30)
        out.append(R(rid, nombre, tipo, ings, pasos, t=t))
    return out


RECETAS = (_construir(_pool_desayunos(), 620, "desayuno", "GD")
           + _construir(_pool_comidas(), 1510, "comida_cena", "GC")
           + _construir(_pool_meriendas(), 620, "merienda", "GM"))

if __name__ == "__main__":
    from collections import Counter
    print("Generadas:", len(RECETAS), dict(Counter(r['tipo'] for r in RECETAS)))
    print("Nombres unicos:", len(set(r['nombre'] for r in RECETAS)))
