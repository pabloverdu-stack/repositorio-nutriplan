/* nutrition.js — motor de cálculo (réplica JS de nutricion.py) */
NP.nutri = (function () {
  // clave -> etiqueta legible + unidad. Orden y agrupación para la ficha.
  const MACROS = [
    ["energia_kcal", "Energía", "kcal"],
    ["proteinas_g", "Proteínas", "g"],
    ["grasas_g", "Grasas", "g"],
    ["sat_g", "· saturadas", "g"],
    ["mono_g", "· monoinsat.", "g"],
    ["poli_g", "· poliinsat.", "g"],
    ["colesterol_mg", "Colesterol", "mg"],
    ["hidratos_g", "Hidratos", "g"],
    ["azucares_g", "· azúcares", "g"],
    ["fibra_g", "Fibra", "g"],
    ["agua_g", "Agua", "g"],
  ];
  const MINERALES = [
    ["calcio_mg", "Calcio", "mg"], ["hierro_mg", "Hierro", "mg"], ["magnesio_mg", "Magnesio", "mg"],
    ["fosforo_mg", "Fósforo", "mg"], ["potasio_mg", "Potasio", "mg"], ["sodio_mg", "Sodio", "mg"],
    ["zinc_mg", "Zinc", "mg"], ["cobre_mg", "Cobre", "mg"], ["manganeso_mg", "Manganeso", "mg"],
    ["selenio_ug", "Selenio", "µg"], ["yodo_ug", "Yodo", "µg"],
  ];
  const VITAMINAS = [
    ["vit_a_ug", "Vitamina A", "µg"], ["vit_d_ug", "Vitamina D", "µg"], ["vit_e_mg", "Vitamina E", "mg"],
    ["vit_c_mg", "Vitamina C", "mg"], ["tiamina_mg", "Tiamina (B1)", "mg"], ["riboflavina_mg", "Riboflavina (B2)", "mg"],
    ["niacina_mg", "Niacina (B3)", "mg"], ["pantotenico_mg", "Ác. pantoténico (B5)", "mg"],
    ["vit_b6_mg", "Vitamina B6", "mg"], ["biotina_ug", "Biotina (B8)", "µg"], ["folato_ug", "Folato", "µg"],
    ["vit_b12_ug", "Vitamina B12", "µg"],
  ];
  const TODOS = [...MACROS, ...MINERALES, ...VITAMINAS];
  const CLAVES = TODOS.map((x) => x[0]);

  // Suma de nutrientes de una lista de ingredientes [{f_id, g}] usando el catálogo (por 100 g)
  function sumIngredientes(ings, catalogo) {
    const tot = {};
    CLAVES.forEach((k) => (tot[k] = 0));
    ings.forEach((ing) => {
      const a = catalogo[ing.f_id];
      if (!a) return;
      const factor = (Number(ing.g) || 0) / 100;
      CLAVES.forEach((k) => { if (a.nut[k] != null) tot[k] += a.nut[k] * factor; });
    });
    CLAVES.forEach((k) => (tot[k] = Math.round(tot[k] * 100) / 100));
    return tot;
  }

  // Suma de varios objetos nutricion (ya calculados) — para un día o un plan
  function sumNutriciones(lista) {
    const tot = {};
    CLAVES.forEach((k) => (tot[k] = 0));
    lista.forEach((n) => { if (n) CLAVES.forEach((k) => (tot[k] += n[k] || 0)); });
    CLAVES.forEach((k) => (tot[k] = Math.round(tot[k] * 10) / 10));
    return tot;
  }

  // Reparto calórico H/P/G (para las barras). Devuelve % de kcal de cada macro.
  function macroPct(n) {
    const h = (n.hidratos_g || 0) * 4, p = (n.proteinas_g || 0) * 4, g = (n.grasas_g || 0) * 9;
    const t = h + p + g || 1;
    return { h: (h / t) * 100, p: (p / t) * 100, g: (g / t) * 100 };
  }

  return { MACROS, MINERALES, VITAMINAS, TODOS, CLAVES, sumIngredientes, sumNutriciones, macroPct };
})();
