/* calcmenu.js — calorías y macros del menú por opciones.
   Las opciones se escriben a mano, una línea por alimento («40 g de copos de avena»,
   «2 huevos», «1 cucharada de aceite de oliva»). Aquí se lee cada línea: se saca la
   cantidad en gramos y se busca el alimento en la tabla BEDCA. Si algo no se reconoce,
   el nutricionista lo enlaza a mano y queda recordado en el menú (plan.enlaces).
   Además se calculan los objetivos de cada comida a partir de los del día. */
NP.calcMenu = (function () {
  const S = NP.util.sinAcentos;

  /* ---------- Alimentos que no están en BEDCA (valores por 100 g, de etiqueta) ---------- */
  const EXTRA = {
    x_whey:        { nombre: "Proteína whey en polvo", kcal: 380, p: 78, g: 6, h: 6 },
    x_tortitas:    { nombre: "Tortitas de arroz", kcal: 387, p: 8, g: 3, h: 81 },
    x_yogurpro:    { nombre: "Yogur alto en proteína", kcal: 60, p: 10, g: 0.2, h: 4.3 },
    x_quesobatido: { nombre: "Queso batido 0 %", kcal: 46, p: 8, g: 0.1, h: 3.5 },
    x_bebavena:    { nombre: "Bebida de avena", kcal: 45, p: 0.8, g: 1.4, h: 7 },
    x_bebalmendra: { nombre: "Bebida de almendra sin azúcar", kcal: 15, p: 0.5, g: 1.1, h: 0.3 },
    x_panmolde:    { nombre: "Pan de molde integral", kcal: 250, p: 11, g: 4, h: 41 },
    x_cremaarroz:  { nombre: "Crema de arroz", kcal: 370, p: 7, g: 1, h: 82 },
    x_cuscus:      { nombre: "Cuscús (seco)", kcal: 376, p: 12.8, g: 0.6, h: 77 },
    x_pechuga:     { nombre: "Pechuga de pollo sin piel, cruda", kcal: 110, p: 23, g: 1.5, h: 0 },
    x_pavo:        { nombre: "Pechuga de pavo, cruda", kcal: 105, p: 24, g: 1, h: 0 },
    x_ternera:     { nombre: "Ternera magra, cruda", kcal: 120, p: 21, g: 4, h: 0 },
    x_frutosrojos: { nombre: "Frutos rojos (mezcla)", kcal: 45, p: 1, g: 0.4, h: 8 },
    x_nada:        { nombre: "Sin calorías (café, infusión, especias...)", kcal: 0, p: 0, g: 0, h: 0 },
  };

  /* ---------- Nombres habituales -> alimento concreto ----------
     Se prueban antes que la búsqueda automática: cada clave son palabras que deben
     aparecer en la línea; gana la que más palabras tenga («arroz integral» a «arroz»).
     El destino es un alimento extra (x_...) o el nombre exacto en BEDCA. */
  const ALIAS = [
    ["avena", "Avena, cruda"], ["copo avena", "Avena, cruda"], ["harina avena", "Harina de avena"],
    ["arroz", "Arroz"], ["arroz integral", "Arroz integral, crudo"], ["basmati", "Arroz"],
    ["pasta", "Pasta alimenticia, cruda"], ["macarron", "Pasta alimenticia, cruda"], ["espagueti", "Pasta alimenticia, cruda"],
    ["fideo", "Pasta alimenticia, cruda"], ["tallarin", "Pasta alimenticia, cruda"], ["pasta integral", "Pasta alimenticia, integral, cruda"],
    ["pan", "Pan blanco, de barra"], ["pan integral", "Pan integral"], ["pan molde", "x_panmolde"], ["tostada", "Pan blanco, de barra"],
    ["patata", "Patata, cruda"], ["boniato", "Boniato, crudo"], ["quinoa", "Quinoa, cruda"], ["cuscus", "x_cuscus"],
    ["tortita arroz", "x_tortitas"], ["tortita", "x_tortitas"], ["crema arroz", "x_cremaarroz"],
    ["huevo", "Huevo de gallina fresco"], ["clara", "Huevo de gallina, clara, cruda"],
    ["pollo", "x_pechuga"], ["pechuga pollo", "x_pechuga"], ["pavo", "x_pavo"], ["pechuga pavo", "x_pavo"],
    ["ternera", "x_ternera"], ["lomo", "Cerdo, lomo, crudo"], ["lomo cerdo", "Cerdo, lomo, crudo"],
    ["atun", "Atún, crudo"], ["atun natural", "Atún, al natural"], ["atun lata", "Atún, al natural"],
    ["salmon", "Salmón"], ["merluza", "Merluza fresca"], ["bacalao", "Bacalao, crudo"], ["gamba", "Gamba roja, cruda"],
    ["langostino", "Gamba roja, cruda"], ["sardina", "Sardina"], ["jamon", "Jamón serrano"], ["jamon serrano", "Jamón serrano"],
    ["jamon cocido", "Jamón cocido, categoría s/e"], ["jamon york", "Jamón cocido, categoría s/e"],
    ["fiambre pavo", "Pavo, fiambre, bajo en grasa"], ["pavo fiambre", "Pavo, fiambre, bajo en grasa"],
    ["leche", "Leche de vaca, semidesnatada, pasteurizada"], ["leche entera", "Leche de vaca, entera"],
    ["leche semidesnatada", "Leche de vaca, semidesnatada, pasteurizada"], ["leche desnatada", "Leche de vaca, desnatada, pasteurizada"],
    ["yogur", "Yogur, enriquecido, natural"], ["yogur natural", "Yogur, enriquecido, natural"],
    ["yogur desnatado", "Yogur, desnatado, sabor natural"], ["yogur griego", "Yogur griego"],
    ["yogur proteina", "x_yogurpro"], ["yogur pro", "x_yogurpro"], ["hipro", "x_yogurpro"],
    ["queso batido", "x_quesobatido"], ["queso fresco", "Queso fresco de burgos"], ["queso", "Queso curado, genérico"],
    ["requeson", "Requesón"], ["kefir", "Kefir"],
    ["bebida avena", "x_bebavena"], ["bebida almendra", "x_bebalmendra"], ["bebida soja", "Bebida de soja"],
    ["whey", "x_whey"], ["proteina", "x_whey"], ["proteina polvo", "x_whey"], ["batido proteina", "x_whey"],
    ["aceite", "Aceite de oliva virgen extra"], ["aceite oliva", "Aceite de oliva virgen extra"], ["aove", "Aceite de oliva virgen extra"],
    ["crema cacahuete", "Crema de cacahuete"], ["mantequilla cacahuete", "Crema de cacahuete"],
    ["nuez", "Nuez"], ["almendra", "Almendra, cruda"], ["aguacate", "Aguacate"], ["chocolate negro", "Chocolate negro"],
    ["platano", "Plátano"], ["manzana", "Manzana"], ["pera", "Pera"], ["naranja", "Naranja"], ["fresa", "Fresa"],
    ["arandano", "Arandano"], ["frutos rojo", "x_frutosrojos"], ["fruto rojo", "x_frutosrojos"], ["fruta", "Manzana"],
    ["kiwi", "Kiwi"], ["mandarina", "Mandarina"], ["melocoton", "Melocotón"], ["sandia", "Sandía"], ["melon", "Melón"],
    ["uva", "Uva blanca"], ["pina", "Piña"], ["datil", "Dátil"],
    ["brocoli", "Brécol, crudo"], ["brecol", "Brécol, crudo"], ["lechuga", "Lechuga"], ["ensalada", "Lechuga"],
    ["tomate", "Tomate"], ["cebolla", "Cebolla"], ["zanahoria", "Zanahoria, cruda"], ["calabacin", "Calabacín"],
    ["champinon", "Champiñon"], ["pimiento", "Pimiento rojo, crudo"], ["espinaca", "Espinaca, hervida"],
    ["judia verde", "Judía verde, cruda"], ["judia blanca", "Judía blanca"], ["alubia", "Judía blanca"],
    ["lenteja", "Lenteja, seca, cruda"], ["lenteja cocida", "Lenteja, hervida"], ["garbanzo", "Garbanzo seco"],
    ["garbanzo cocido", "Garbanzo, en conserva"], ["garbanzo bote", "Garbanzo, en conserva"], ["tofu", "Tofu"],
    ["miel", "Miel"], ["azucar", "Azúcar blanca"], ["mantequilla", "Mantequilla salada"],
    ["cafe", "x_nada"], ["infusion", "x_nada"], ["te", "x_nada"], ["especia", "x_nada"], ["sal", "x_nada"],
    ["vinagre", "x_nada"], ["limon", "x_nada"], ["agua", "x_nada"], ["edulcorante", "x_nada"],
  ];

  /* Peso de una unidad («2 huevos», «1 plátano») y de las medidas caseras */
  const PIEZA = [
    ["huevo", 55], ["clara", 33], ["platano", 120], ["manzana", 150], ["pera", 150], ["naranja", 150],
    ["kiwi", 75], ["mandarina", 70], ["melocoton", 150], ["fruta", 150], ["yogur", 125], ["tortita", 8],
    ["tostada", 30], ["rebanada", 30], ["pan", 60], ["nuez", 5], ["almendra", 1.2], ["datil", 7], ["galleta", 8],
    ["tomate", 120], ["patata", 170], ["aguacate", 140], ["lata", 56], ["loncha", 20],
  ];
  const MEDIDAS = {
    cucharada: 15, cucharadita: 5, cazo: 30, scoop: 30, vaso: 200, taza: 200, punado: 25,
    rebanada: 30, lata: 56, loncha: 20, chorrito: 5, chorro: 10, pizca: 0, onza: 10,
  };

  const PALABRAS_VACIAS = new Set(["de", "del", "con", "sin", "al", "a", "la", "el", "los", "las", "en", "y", "o",
    "para", "tipo", "un", "una", "unos", "unas", "gusto", "poco", "mas", "su", "e"]);

  /** «huevos» -> «huevo», «nueces» -> «nuez», «macarrones» -> «macarron» */
  function singular(w) {
    if (w.length <= 3) return w;
    if (w.endsWith("ces")) return w.slice(0, -3) + "z";
    if (/[lrnd]es$/.test(w)) return w.slice(0, -2);
    if (w.endsWith("s")) return w.slice(0, -1);
    return w;
  }
  const palabras = (s) => S(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter(Boolean).map(singular);
  const claveDe = (nombre) => palabras(nombre).filter((w) => !PALABRAS_VACIAS.has(w)).join(" ");

  /* ---------- Lectura de una línea ---------- */
  const NUM = "(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|½|¼|¾)";
  const aNum = (s) => {
    if (s === "½") return 0.5; if (s === "¼") return 0.25; if (s === "¾") return 0.75;
    if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return b ? a / b : 0; }
    return Number(s.replace(",", "."));
  };
  const UNIDAD_PESO = { kg: 1000, g: 1, gr: 1, grs: 1, gramo: 1, gramos: 1, ml: 1, cl: 10, l: 1000, litro: 1000, litros: 1000 };

  /** Separa cantidad y alimento: {g} si viene en gramos/ml, {n, medida} si son unidades o medidas caseras */
  function leer(linea) {
    const t = String(linea).trim();
    // 1) Gramos o mililitros en cualquier sitio: «40 g de avena», «Avena (40 g)», «250ml leche»
    const reG = new RegExp(NUM + "\\s*(kg|grs|gramos|gramo|gr|g|ml|cl|litros|litro|l)\\b\\.?", "i");
    const mG = t.match(reG);
    if (mG) {
      const g = aNum(mG[1]) * UNIDAD_PESO[mG[2].toLowerCase()];
      const nombre = t.replace(mG[0], " ").replace(/[()]/g, " ").replace(/^\s*(de|del)\s+/i, "").trim();
      return { g, nombre };
    }
    // 2) Unidades al principio: «2 huevos», «1 cucharada de aceite», «½ aguacate»
    const mN = t.match(new RegExp("^" + NUM + "\\s+(.*)$"));
    if (mN) {
      const n = aNum(mN[1]);
      let resto = mN[2];
      const w = palabras(resto)[0];
      const medida = w && Object.prototype.hasOwnProperty.call(MEDIDAS, w) ? w : null;
      if (medida) resto = resto.replace(/^\S+\s*/, "").replace(/^(de|del)\s+/i, "");
      return { n, medida, nombre: resto.trim() };
    }
    return { nombre: t };
  }

  /* ---------- Búsqueda del alimento ---------- */
  let porNombre = null; // nombre normalizado -> f_id (se crea al primer uso)
  function fidPorNombre(nombre) {
    if (!porNombre) {
      porNombre = new Map();
      NP.data.alimentos.forEach((a) => porNombre.set(a.nombre_norm, a.f_id));
    }
    return porNombre.get(S(nombre).replace(/\s+/g, " ").trim()) || null;
  }

  /** Datos por 100 g de un alimento: {nombre, kcal, p, g, h} */
  function datos(id) {
    if (!id) return null;
    if (EXTRA[id]) return EXTRA[id];
    const a = NP.data.catalogo[id];
    if (!a || !a.nut) return null;
    const n = a.nut;
    return { nombre: a.nombre.trim(), kcal: n.energia_kcal || 0, p: n.proteinas_g || 0, g: n.grasas_g || 0, h: n.hidratos_g || 0 };
  }

  function porAlias(ws) {
    let mejor = null, nMejor = 0;
    ALIAS.forEach(([clave, destino]) => {
      const cw = clave.split(" ");
      if (cw.length > nMejor && cw.every((w) => ws.indexOf(w) >= 0)) {
        const id = destino.startsWith("x_") ? destino : fidPorNombre(destino);
        if (id) { mejor = id; nMejor = cw.length; }
      }
    });
    return mejor;
  }

  /** Búsqueda en BEDCA por palabras completas; si no hay, se van quitando palabras del final */
  function porBusqueda(ws) {
    const lista = NP.data.alimentos;
    const empiezaPalabra = (nom, w) => (" " + nom.replace(/[^a-z0-9ñ ]/g, " ")).indexOf(" " + w) >= 0;
    for (let n = ws.length; n >= 1; n--) {
      const buscadas = ws.slice(0, n);
      const cands = lista.filter((a) => buscadas.every((w) => empiezaPalabra(a.nombre_norm, w)));
      if (!cands.length) continue;
      const puntos = (a) => {
        const nom = a.nombre_norm;
        let s = 0;
        if (nom.startsWith(buscadas[0])) s += 5;
        if (/\bcrud/.test(nom)) s += 1;
        if (/frit|empanad|rebozad|almibar|azucar|condensad|polvo|salad|mermelada|zumo|nectar|batido|helado/.test(nom) &&
          !ws.some((w) => nom.includes(w) && /frit|empan|reboz|almib|azuc|conden|polvo|salad|mermel|zumo|nectar|batid|helad/.test(w))) s -= 4;
        return s - nom.length / 40;
      };
      cands.sort((a, b) => puntos(b) - puntos(a));
      return { id: cands[0].f_id, aprox: n < ws.length };
    }
    return null;
  }

  /* Enlaces que el nutricionista ha corregido a mano: primero los del menú,
     después los que ha usado en otros menús en este navegador. */
  const CLAVE_LOCAL = "np_enlaces_alimentos";
  function enlacesLocales() {
    try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || "{}"); } catch (e) { return {}; }
  }
  function recordarEnlace(clave, enlace) {
    try {
      const m = enlacesLocales();
      m[clave] = enlace;
      localStorage.setItem(CLAVE_LOCAL, JSON.stringify(m));
    } catch (e) { /* sin almacenamiento: solo queda en el menú */ }
  }

  const MACROS0 = () => ({ kcal: 0, p: 0, g: 0, h: 0 });

  /** Resultado de una línea: {texto, nombre, clave, g, id, alimento, estado, n:{kcal,p,g,h}}
   *  estado: "ok" (reconocido), "aprox" (encontrado quitando palabras), "a-mano" (enlazado por el
   *  nutricionista), "libre" (al gusto: no suma), "sin-peso" (unidades de un alimento sin peso
   *  conocido), "sin-cantidad", "no-encontrado" */
  function calcularLinea(texto, enlaces) {
    const l = leer(texto);
    const clave = claveDe(l.nombre);
    const ws = clave.split(" ").filter(Boolean);
    const r = { texto, nombre: l.nombre, clave, g: null, id: null, alimento: null, estado: "no-encontrado", n: MACROS0() };
    if (!ws.length) { r.estado = "sin-cantidad"; return r; }

    const en = (enlaces && enlaces[clave]) || enlacesLocales()[clave] || null;
    if (en && en.id) { r.id = en.id; r.estado = "a-mano"; }
    else {
      const a = porAlias(ws);
      if (a) { r.id = a; r.estado = "ok"; }
      else {
        const b = porBusqueda(ws);
        if (b) { r.id = b.id; r.estado = b.aprox ? "aprox" : "ok"; }
      }
    }
    const d = datos(r.id);
    if (!d) { r.estado = "no-encontrado"; return r; }
    r.alimento = d.nombre;

    // Gramos de la línea
    if (l.g != null) r.g = l.g;
    else if (l.n != null) {
      let pesoUnidad = en && en.gUnidad ? en.gUnidad : null;
      if (!pesoUnidad && l.medida) {
        pesoUnidad = MEDIDAS[l.medida];
        if (l.medida === "cucharada" && /aceite/.test(clave)) pesoUnidad = 10;
      }
      if (!pesoUnidad) { const pz = PIEZA.find(([k]) => ws.indexOf(k) >= 0); if (pz) pesoUnidad = pz[1]; }
      if (pesoUnidad == null) { r.estado = "sin-peso"; return r; }
      r.g = l.n * pesoUnidad;
    } else if (en && en.g != null) r.g = en.g;
    else if (r.id === "x_nada") r.g = 0;
    // «Ensalada al gusto», «verdura libre»: sin cantidad a propósito, no suma
    else if (/al gusto|a voluntad|libre|sin limite/.test(S(texto))) { r.g = 0; r.estado = "libre"; }
    else { r.estado = "sin-cantidad"; return r; }

    const f = r.g / 100;
    r.n = { kcal: d.kcal * f, p: d.p * f, g: d.g * f, h: d.h * f };
    return r;
  }

  /* ---------- Alimentos como fichas: {id, fid, nombre, g, casera?, libre?} ----------
     fid es el alimento de la tabla (o un extra x_...). Sin fid la ficha está pendiente de elegir
     alimento; con libre es algo «al gusto» que no suma. */
  function calcularItem(it) {
    const d = it.libre ? null : datos(it.fid);
    if (!d || !(Number(it.g) >= 0)) return { n: MACROS0(), d, ok: !!it.libre };
    const f = (Number(it.g) || 0) / 100;
    return { n: { kcal: d.kcal * f, p: d.p * f, g: d.g * f, h: d.h * f }, d, ok: true };
  }
  /** Texto de una ficha para el paciente y el PDF: «80 g de arroz (1 taza)» */
  const textoItem = (it) => it.libre || !it.fid || it.g == null
    ? it.nombre
    : fmtG(it.g) + " g de " + it.nombre + (it.casera ? " (" + it.casera + ")" : "");
  const fmtG = (g) => String(Math.round(g * 10) / 10).replace(".", ",");

  /** Convierte las líneas de texto de antes en fichas (lo que no se reconoce queda pendiente) */
  function lineasAItems(lineas, enlaces) {
    return (lineas || []).map((t) => {
      const r = calcularLinea(t, enlaces);
      const base = { id: NP.util.uid() };
      if (r.estado === "libre") return Object.assign(base, { nombre: t, libre: true });
      if (r.id && r.g != null && r.estado !== "no-encontrado") {
        const nom = (r.nombre || r.alimento || t).trim();
        return Object.assign(base, { fid: r.id, nombre: nom.charAt(0).toUpperCase() + nom.slice(1), g: Math.round(r.g) });
      }
      return Object.assign(base, { nombre: t, fid: null, g: null });
    });
  }

  /** Buscador de alimentos: primero el habitual («pollo» -> pechuga de pollo), después los
   *  extra y la tabla BEDCA por palabras completas, con los que empiezan por lo buscado delante */
  function buscar(texto, max) {
    max = max || 20;
    const ws = claveDe(texto).split(" ").filter(Boolean);
    if (!ws.length) return [];
    const vistos = new Set();
    const res = [];
    const add = (id) => {
      if (!id || vistos.has(id)) return;
      const d = datos(id);
      if (!d) return;
      vistos.add(id); res.push({ id, d });
    };
    add(porAlias(ws));
    Object.keys(EXTRA).forEach((k) => {
      if (k !== "x_nada" && ws.every((w) => palabras(EXTRA[k].nombre).some((p) => p.startsWith(w)))) add(k);
    });
    const empieza = (nom, w) => (" " + nom.replace(/[^a-z0-9ñ ]/g, " ")).indexOf(" " + w) >= 0;
    NP.data.alimentos.filter((a) => ws.every((w) => empieza(a.nombre_norm, w)))
      .sort((a, b) => (b.nombre_norm.startsWith(ws[0]) - a.nombre_norm.startsWith(ws[0])) || a.nombre_norm.length - b.nombre_norm.length)
      .slice(0, max).forEach((a) => add(a.f_id));
    if (!res.length) NP.data.buscarAlimentos(texto, max).forEach((a) => add(a.f_id));
    return res.slice(0, max);
  }

  /** Total de una opción del menú: {n, lineas, dudosas} */
  function calcularOpcion(op, enlaces) {
    if (Array.isArray(op.items)) {
      const n = MACROS0();
      let dudosas = 0;
      op.items.forEach((it) => {
        const r = calcularItem(it);
        if (!r.ok) dudosas++;
        n.kcal += r.n.kcal; n.p += r.n.p; n.g += r.n.g; n.h += r.n.h;
      });
      return { n, lineas: [], dudosas };
    }
    const lineas = (op.alimentos || []).map((t) => calcularLinea(t, enlaces));
    const n = MACROS0();
    lineas.forEach((l) => { n.kcal += l.n.kcal; n.p += l.n.p; n.g += l.n.g; n.h += l.n.h; });
    const dudosas = lineas.filter((l) => l.estado === "no-encontrado" || l.estado === "sin-peso" || l.estado === "sin-cantidad").length;
    return { n, lineas, dudosas };
  }

  /* ---------- Objetivos ---------- */
  /* Peso de cada comida en el reparto del día (se normaliza con las comidas que haya) */
  const PESO_COMIDA = [
    [/levant/, 3], [/desayun/, 25], [/media ma|almuerzo|tentempi/, 10], [/antes de entren|pre.?entren/, 10],
    [/post|despues de entren/, 12], [/merienda/, 10], [/cena/, 25], [/dormir|acostar|recena/, 5], [/comida/, 35],
  ];
  const pesoComida = (nombre) => {
    const n = S(nombre);
    const x = PESO_COMIDA.find(([re]) => re.test(n));
    return x ? x[1] : 15;
  };

  /** Objetivos del día a partir de la ficha del paciente (kcal objetivo y reparto de macros) */
  function objetivosDeFicha(pac) {
    const kcal = Number(pac && pac.kcal_objetivo) || 2000;
    const peso = Number(pac && pac.peso_kg) || 70;
    const m = NP.calorias.macros(kcal, peso, pac && pac.objetivo_calc);
    return { kcal, p: m.proteinas_g, g: m.grasas_g, h: m.hidratos_g };
  }

  /** Objetivo de cada comida de un bloque: {id -> {kcal,p,g,h, manual}} */
  function objetivosComidas(bloque, obj) {
    const res = {};
    if (!obj || !obj.kcal) return res;
    const comidas = bloque.comidas || [];
    // Las comidas fijadas a mano se restan; el resto del día se reparte entre las demás
    const manuales = comidas.filter((c) => c.objetivo);
    const resto = {
      kcal: obj.kcal - manuales.reduce((s, c) => s + (Number(c.objetivo.kcal) || 0), 0),
      p: obj.p - manuales.reduce((s, c) => s + (Number(c.objetivo.p) || 0), 0),
      g: obj.g - manuales.reduce((s, c) => s + (Number(c.objetivo.g) || 0), 0),
      h: obj.h - manuales.reduce((s, c) => s + (Number(c.objetivo.h) || 0), 0),
    };
    const autos = comidas.filter((c) => !c.objetivo);
    const pesos = autos.map((c) => (obj.reparto === "igual" ? 1 : pesoComida(c.nombre)));
    const total = pesos.reduce((s, x) => s + x, 0) || 1;
    manuales.forEach((c) => { res[c.id] = Object.assign({ manual: true }, c.objetivo); });
    autos.forEach((c, i) => {
      const f = pesos[i] / total;
      res[c.id] = { kcal: Math.max(0, resto.kcal * f), p: Math.max(0, resto.p * f), g: Math.max(0, resto.g * f), h: Math.max(0, resto.h * f) };
    });
    return res;
  }

  /* Estado de un valor frente a su objetivo. El margen es un % del objetivo, pero nunca
     menos de un mínimo fijo: con 10 g de grasa, un 15 % serían 1,5 g y eso no es realista. */
  const MINIMO = { kcal: 50, p: 5, g: 4, h: 8 };
  function estado(valor, objetivo, clave, margenPct) {
    if (objetivo == null || !(objetivo > 0)) return { cls: "", dif: 0 };
    const tol = Math.max((margenPct / 100) * objetivo, MINIMO[clave]);
    const dif = valor - objetivo;
    const a = Math.abs(dif);
    return { cls: a <= tol ? "ok" : a <= tol * 2 ? "cerca" : "fuera", dif, tol };
  }

  return {
    EXTRA, datos, leer, buscar, calcularLinea, calcularOpcion, calcularItem, textoItem, lineasAItems, claveDe, recordarEnlace,
    objetivosDeFicha, objetivosComidas, estado, pesoComida,
  };
})();
