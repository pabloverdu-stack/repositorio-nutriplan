/* data.js — carga y consulta del recetario + catálogo BEDCA */
NP.data = (function () {
  const S = NP.util.sinAcentos;
  // Toma el ?v=N con el que se cargó este propio script (definido en index.html)
  const VER = (function () {
    const s = document.currentScript || [...document.scripts].find((x) => /data\.js/.test(x.src));
    const m = s && s.src.match(/[?&]v=([^&]+)/);
    return m ? "?v=" + m[1] : "";
  })();
  let recetas = [];         // del recetario.json
  const porId = {};         // id -> receta
  const porTipo = { desayuno: [], comida_cena: [], merienda: [] };
  let catalogo = {};        // f_id -> {nombre, nut}
  let catalogoList = [];    // [{f_id, nombre, nombre_norm}]

  async function cargar() {
    const [rj, cj] = await Promise.all([
      // La versión del propio script (?v=N) se propaga a los datos para que el
      // navegador no sirva un recetario cacheado cuando se actualizan las recetas.
      fetch("data/recetario.json" + VER).then((r) => r.json()),
      fetch("data/catalogo.json" + VER).then((r) => r.json()),
    ]);
    recetas = rj.recetas || [];
    recetas.forEach((r) => {
      porId[r.id] = r;
      (porTipo[r.tipo] || (porTipo[r.tipo] = [])).push(r);
    });
    catalogo = cj;
    // Solo alimentos con datos reales (BEDCA tiene registros vacíos que hay que ocultar)
    const usable = (n) => n && (n.energia_kcal > 0 || n.proteinas_g != null || n.hidratos_g != null || n.grasas_g != null);
    // BEDCA repite el mismo alimento en varios registros (distintas fuentes). Agrupamos por
    // nombre normalizado y nos quedamos con el más completo (más nutrientes) para evitar duplicados.
    const clave = (nombre) => S(nombre).replace(/\s+/g, " ").trim();
    const mejores = new Map();
    Object.keys(cj).forEach((fid) => {
      const food = cj[fid];
      if (!usable(food.nut)) return;
      const k = clave(food.nombre);
      const nkeys = Object.keys(food.nut).length;
      const prev = mejores.get(k);
      if (!prev || nkeys > prev.nkeys) mejores.set(k, { f_id: fid, nombre: food.nombre.trim(), nombre_norm: k, nkeys });
    });
    catalogoList = [...mejores.values()]
      .map(({ f_id, nombre, nombre_norm }) => ({ f_id, nombre, nombre_norm }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return { nRecetas: recetas.length, nAlimentos: catalogoList.length };
  }

  // ---- Recetas propias (creadas por el nutricionista) se integran en las búsquedas ----
  function todasRecetas() { return recetas.concat(NP.store.getPropias()); }
  function getReceta(id) { return porId[id] || NP.store.getPropias().find((r) => r.id === id) || null; }

  // separa la consulta en palabras normalizadas (todas deben aparecer)
  const tokens = (q) => S(q).split(/\s+/).filter(Boolean);
  const matchTodos = (texto, toks) => { const t = S(texto); return toks.every((w) => t.includes(w)); };

  // Búsqueda/filtrado de recetas (sin filtro por kcal: el ajuste calórico se hace
  // con los gramos de cada plato, no escondiendo recetas)
  // Una receta encaja en un tipo por su propio tipo o por su lista "apto"
  // (p. ej. un yogur es merienda, pero también vale de postre en comida y cena).
  const encajaTipo = (r, tipo) =>
    r.tipo === tipo || (Array.isArray(r.apto) && r.apto.indexOf(tipo) >= 0);

  function buscarRecetas({ q = "", tipo = "", limite = 120, soloFav = false } = {}) {
    const toks = tokens(q);
    let base = tipo ? todasRecetas().filter((r) => encajaTipo(r, tipo)) : todasRecetas();
    if (soloFav) {
      const favs = new Set(NP.store.getFavoritas());
      base = base.filter((r) => favs.has(r.id));
    }
    const res = toks.length ? base.filter((r) => matchTodos(r.nombre, toks)) : base;
    return res.slice(0, limite);
  }

  // Alternativas ("recetas de cambio"): misma tipo, kcal ±tol, ordenadas por cercanía
  function alternativas(receta, n = 8, tol = 0.18) {
    const k = receta.nutricion.energia_kcal;
    const lo = k * (1 - tol), hi = k * (1 + tol);
    return todasRecetas()
      .filter((r) => r.tipo === receta.tipo && r.id !== receta.id &&
        r.nutricion.energia_kcal >= lo && r.nutricion.energia_kcal <= hi)
      .sort((a, b) => Math.abs(a.nutricion.energia_kcal - k) - Math.abs(b.nutricion.energia_kcal - k))
      .slice(0, n);
  }

  // Búsqueda de alimentos BEDCA (para el constructor)
  function buscarAlimentos(q, limite = 30) {
    const toks = tokens(q);
    if (!toks.length) return [];
    return catalogoList
      .filter((a) => toks.every((w) => a.nombre_norm.includes(w)))
      .sort((a, b) => a.nombre.length - b.nombre.length)
      .slice(0, limite)
      .map((a) => ({ f_id: a.f_id, nombre: a.nombre, nut: catalogo[a.f_id].nut }));
  }

  return {
    cargar, buscarRecetas, alternativas, buscarAlimentos, getReceta, todasRecetas,
    get recetas() { return recetas; },
    get porTipo() { return porTipo; },
    get catalogo() { return catalogo; },
  };
})();
