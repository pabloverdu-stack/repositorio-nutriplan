# -*- coding: utf-8 -*-
"""Catalogo maestro de ingredientes: clave canonica -> mejor f_id de BEDCA.
Usa nutricion.mejor() con termino de busqueda; OVERRIDE fuerza f_id concretos
donde la heuristica no acierta. resolver(cat) devuelve {clave: (f_id, nombre)}."""
import nutricion as n

TERMINOS = {
 # ---- proteina animal (peso en CRUDO) ----
 'pollo_pechuga':'pollo, pechuga, sin piel','pollo_muslo':'pollo, muslo, sin piel',
 'pavo_pechuga':'pavo, pechuga, sin piel','cerdo_lomo':'cerdo, lomo, crudo',
 'cerdo_solomillo':'cerdo, solomillo, crudo','vacuno_solomillo':'vaca/buey, solomillo, crudo',
 'carne_picada':'carne picada','conejo':'conejo','jamon_serrano':'jamon serrano',
 'jamon_cocido':'jamon cocido','pavo_fiambre':'pavo, fiambre',
 'huevo':'huevo de gallina fresco','huevo_cocido':'huevo de gallina, hervido','clara':'huevo de gallina, clara',
 # ---- pescado / marisco ----
 'merluza':'merluza, cruda','salmon':'salmon','bacalao':'bacalao, crudo','atun_lata':'atun en aceite',
 'atun_fresco':'atun, crudo','bonito':'bonito, crudo','sardina':'sardina, cruda','caballa':'caballa, cruda',
 'trucha':'trucha','dorada':'dorada','lubina':'lubina','lenguado':'lenguado, crudo','gallo':'gallo',
 'rape':'rape','boqueron':'boqueron','gamba':'gamba','langostino':'langostino, crudo','sepia':'sepia',
 'calamar':'calamar','pulpo':'pulpo','mejillon':'mejillon','almeja':'almeja',
 # ---- legumbres (cocidas) ----
 'lenteja_cocida':'lenteja, en conserva','garbanzo_cocido':'garbanzo, en conserva',
 'alubia_blanca':'alubia blanca, en conserva','alubia_pinta':'alubia pinta','guisante':'guisante',
 # ---- cereales / hidratos ----
 'arroz_integral':'arroz integral, crudo','arroz_blanco':'arroz','pasta':'pasta alimenticia, cruda',
 'patata':'patata, cruda','boniato':'boniato, crudo','quinoa':'quinoa, cruda','avena':'avena, cruda',
 'pan_integral':'pan integral','pan_blanco':'pan blanco','pan_centeno':'pan de centeno',
 # ---- lacteos ----
 'leche_semi':'leche de vaca, semidesnatada','yogur_natural':'yogur, bulgaro','yogur_griego':'yogur griego',
 'queso_fresco':'queso fresco de burgos','requeson':'requeson','queso_curado':'queso curado','mozzarella':'mozzarella',
 # ---- verduras ----
 'cebolla':'cebolla','ajo':'ajo','tomate':'tomate','pimiento':'pimiento rojo, crudo','pimiento_verde':'pimiento verde',
 'calabacin':'calabacin','berenjena':'berenjena','zanahoria':'zanahoria, cruda','brocoli':'brocol',
 'coliflor':'coliflor','judia_verde':'judia verde','champinon':'champiñon','espinaca':'espinaca',
 'acelga':'acelga','lechuga':'lechuga','pepino':'pepino','esparrago':'esparrago, verde','puerro':'puerro',
 'calabaza':'calabaza','alcachofa':'alcachofa','aguacate':'aguacate','setas':'seta',
 # ---- frutas ----
 'platano':'platano','manzana':'manzana','naranja':'naranja','pera':'pera','kiwi':'kiwi','fresa':'fresa',
 'arandano':'arandano','uva':'uva','mandarina':'mandarina','melocoton':'melocoton','mango':'mango',
 'sandia':'sandia','melon':'melon','cereza':'cereza','frambuesa':'frambuesa','higo':'higo','ciruela':'ciruela',
 # ---- secos / grasas / otros ----
 'nuez':'nuez','almendra':'almendra, cruda','avellana':'avellana','pistacho':'pistacho','anacardo':'anacardo',
 'cacahuete':'cacahuete','crema_cacahuete':'crema de cacahuete','pasas':'uva pasa','datil':'datil',
 'aceite_oliva':'aceite de oliva virgen extra','aceituna':'aceituna','miel':'miel','chocolate_negro':'chocolate negro',
 'canela':'canela','muesli':'cereales desayuno base muesli','tofu':'tofu',
}

# f_id forzados donde la heuristica no da el alimento correcto/fresco
OVERRIDE = {
 'huevo':'2127','huevo_cocido':'2126','salmon':'2626','manzana':'2231','naranja':'2235','platano':'2245',
 'kiwi':'2228','fresa':'2225','tomate':'1879','pimiento':'1894','calabacin':'1776','berenjena':'1921',
 'cebolla':'1773','leche_semi':'1319','pollo_pechuga':'994','aguacate':'1623','pera':'1729','uva':'2115',
 'mandarina':'1705','arroz_blanco':'2102','tomate_cherry':'1879','champinon':'2384','espinaca':'2395',
 'acelga':'1922','judia_verde':'2198','zanahoria':'1892','yogur_natural':'953','queso_fresco':'1794',
 'brocoli':'312','esparrago':'151','melocoton':'1711',
 'arroz_blanco':'1630','uva':'1017','guisante':'1175','lenguado':'2341','pollo_muslo':'1388',
 'merluza':'2347','bonito':'800','sardina':'2630','chocolate_negro':'28','aceite_oliva':'2544',
}

# nombre legible por clave (para mostrar en la receta)
NOMBRE = {
 'pollo_pechuga':'Pechuga de pollo','pollo_muslo':'Muslo de pollo','pavo_pechuga':'Pechuga de pavo',
 'cerdo_lomo':'Lomo de cerdo','cerdo_solomillo':'Solomillo de cerdo','vacuno_solomillo':'Ternera (solomillo)',
 'carne_picada':'Carne picada','conejo':'Conejo','jamon_serrano':'Jamon serrano','jamon_cocido':'Jamon cocido',
 'pavo_fiambre':'Pavo (fiambre)','huevo':'Huevo','huevo_cocido':'Huevo cocido','clara':'Claras de huevo',
 'merluza':'Merluza','salmon':'Salmon','bacalao':'Bacalao','atun_lata':'Atun en aceite','atun_fresco':'Atun fresco',
 'bonito':'Bonito','sardina':'Sardinas','caballa':'Caballa','trucha':'Trucha','dorada':'Dorada','lubina':'Lubina',
 'lenguado':'Lenguado','gallo':'Gallo','rape':'Rape','boqueron':'Boquerones','gamba':'Gambas','langostino':'Langostinos',
 'sepia':'Sepia','calamar':'Calamar','pulpo':'Pulpo','mejillon':'Mejillones','almeja':'Almejas',
 'lenteja_cocida':'Lentejas cocidas','garbanzo_cocido':'Garbanzos cocidos','alubia_blanca':'Alubias blancas',
 'guisante':'Guisantes','arroz_integral':'Arroz integral','arroz_blanco':'Arroz','pasta':'Pasta','patata':'Patata',
 'boniato':'Boniato','quinoa':'Quinoa','avena':'Copos de avena','pan_integral':'Pan integral','pan_blanco':'Pan blanco',
 'pan_centeno':'Pan de centeno','leche_semi':'Leche semidesnatada','yogur_natural':'Yogur natural','yogur_griego':'Yogur griego',
 'queso_fresco':'Queso fresco','requeson':'Requeson','queso_curado':'Queso curado','mozzarella':'Mozzarella',
 'cebolla':'Cebolla','ajo':'Ajo','tomate':'Tomate','pimiento':'Pimiento rojo','calabacin':'Calabacin','berenjena':'Berenjena',
 'zanahoria':'Zanahoria','brocoli':'Brocoli','coliflor':'Coliflor','judia_verde':'Judias verdes','champinon':'Champiñones',
 'espinaca':'Espinacas','acelga':'Acelgas','lechuga':'Lechuga','pepino':'Pepino','esparrago':'Esparragos','puerro':'Puerro',
 'calabaza':'Calabaza','alcachofa':'Alcachofas','aguacate':'Aguacate','setas':'Setas',
 'platano':'Platano','manzana':'Manzana','naranja':'Naranja','pera':'Pera','kiwi':'Kiwi','fresa':'Fresas','arandano':'Arandanos',
 'uva':'Uvas','mandarina':'Mandarina','melocoton':'Melocoton','mango':'Mango','sandia':'Sandia','melon':'Melon',
 'cereza':'Cerezas','frambuesa':'Frambuesas','higo':'Higos','ciruela':'Ciruelas',
 'nuez':'Nueces','almendra':'Almendras','avellana':'Avellanas','pistacho':'Pistachos','anacardo':'Anacardos',
 'cacahuete':'Cacahuetes','crema_cacahuete':'Crema de cacahuete','pasas':'Uvas pasas','datil':'Datiles',
 'aceite_oliva':'Aceite de oliva virgen extra','aceituna':'Aceitunas','miel':'Miel','chocolate_negro':'Chocolate negro',
 'canela':'Canela','muesli':'Muesli','tofu':'Tofu',
}

def display(clave):
    return NOMBRE.get(clave, clave.replace('_', ' ').capitalize())


def resolver(cat):
    out, avisos = {}, []
    for clave, term in TERMINOS.items():
        if clave in OVERRIDE and OVERRIDE[clave] in cat:
            fid = OVERRIDE[clave]; out[clave] = (fid, cat[fid]['nombre']); continue
        m = n.mejor(cat, term)
        if not m:
            avisos.append(clave); continue
        out[clave] = m
    return out, avisos

if __name__ == "__main__":
    cat = n.cargar_catalogo()
    ing, avisos = resolver(cat)
    print("Resueltos:", len(ing), "| Sin resolver:", avisos, "\n")
    for k, (fid, nom) in ing.items():
        nut = cat[fid]['nut']
        print(f'{k:<16} {fid:<6} p={nut.get("proteinas_g")!s:<7} kcal={nut.get("energia_kcal")!s:<7} {nom}')
