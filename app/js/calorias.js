/* calorias.js — cálculo de necesidades energéticas (Harris-Benedict, Mifflin o, con el % de
   grasa, Katch-McArdle / Cunningham sobre la masa magra) + actividad física */
NP.calorias = (function () {

  // Niveles de actividad física (PAL · Physical Activity Level)
  const ACTIVIDAD = [
    { key: "sedentario", factor: 1.200, label: "Sedentario", desc: "Trabajo de oficina, poco o nada de ejercicio" },
    { key: "ligero",     factor: 1.375, label: "Ligera",     desc: "Ejercicio suave 1-3 días/semana" },
    { key: "moderado",   factor: 1.550, label: "Moderada",   desc: "Ejercicio moderado 3-5 días/semana" },
    { key: "alto",       factor: 1.725, label: "Alta",       desc: "Ejercicio intenso 6-7 días/semana" },
    { key: "muy_alto",   factor: 1.900, label: "Muy alta",   desc: "Ejercicio muy intenso o trabajo físico" },
  ];

  // Ajuste según el objetivo del paciente (% sobre el gasto total)
  const OBJETIVOS = [
    { key: "deficit_alto",  ajuste: -0.25, label: "Pérdida de grasa marcada", desc: "-25 % · déficit alto" },
    { key: "deficit",       ajuste: -0.15, label: "Pérdida de grasa",         desc: "-15 % · déficit moderado" },
    { key: "mantenimiento", ajuste:  0.00, label: "Mantenimiento",            desc: "Mantener el peso actual" },
    { key: "superavit",     ajuste:  0.10, label: "Ganancia muscular",        desc: "+10 % · superávit moderado" },
    { key: "superavit_alto",ajuste:  0.20, label: "Ganancia de peso",         desc: "+20 % · superávit alto" },
  ];

  // Fórmulas disponibles
  const FORMULAS = {
    // Harris-Benedict revisada (Roza & Shizgal, 1984) — la más usada hoy
    hb_revisada: {
      label: "Harris-Benedict (revisada 1984)",
      tmb: (s, peso, altura, edad) => s === "hombre"
        ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * edad
        : 447.593 + 9.247 * peso + 3.098 * altura - 4.330 * edad,
    },
    // Harris-Benedict original (1919)
    hb_original: {
      label: "Harris-Benedict (original 1919)",
      tmb: (s, peso, altura, edad) => s === "hombre"
        ? 66.473 + 13.7516 * peso + 5.0033 * altura - 6.755 * edad
        : 655.0955 + 9.5634 * peso + 1.8496 * altura - 4.6756 * edad,
    },
    // Mifflin-St Jeor — alternativa considerada más precisa en población actual
    mifflin: {
      label: "Mifflin-St Jeor (1990)",
      tmb: (s, peso, altura, edad) => 10 * peso + 6.25 * altura - 5 * edad + (s === "hombre" ? 5 : -161),
    },
    // Las dos siguientes parten de la masa magra (peso - grasa), así que necesitan el % de grasa.
    // No dependen del sexo ni de la edad: la diferencia entre personas ya la recoge la masa magra.
    // Katch-McArdle — la más usada cuando se conoce la composición corporal
    katch: {
      label: "Katch-McArdle (masa magra)",
      grasa: true,
      tmb: (s, peso, altura, edad, magra) => 370 + 21.6 * magra,
    },
    // Cunningham (1980) — pensada para personas activas / deportistas
    cunningham: {
      label: "Cunningham (masa magra · deportistas)",
      grasa: true,
      tmb: (s, peso, altura, edad, magra) => 500 + 22 * magra,
    },
  };

  /** Normaliza el sexo a lo que usan las fórmulas: "hombre" | "mujer" | "indeterminado".
   *  Las fórmulas de TMB solo contemplan dos sexos; si no consta o es "Otro" se promedian
   *  ambas en lugar de asumir uno (ver calcular()). */
  function normSexo(s) {
    const t = String(s || "").toLowerCase();
    if (t.indexOf("hombre") >= 0 || t === "h" || t === "m" || t === "masculino" || t === "male") return "hombre";
    if (t.indexOf("mujer") >= 0 || t === "f" || t === "femenino" || t === "female") return "mujer";
    return "indeterminado";
  }

  /** Edad en años a partir de la fecha de nacimiento (YYYY-MM-DD). */
  function edadDe(fechaISO) {
    if (!fechaISO) return null;
    const n = new Date(fechaISO);
    if (isNaN(n)) return null;
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
    return e >= 0 && e < 130 ? e : null;
  }

  const factorDe = (key) => (ACTIVIDAD.find((a) => a.key === key) || ACTIVIDAD[0]).factor;
  const ajusteDe = (key) => {
    const o = OBJETIVOS.find((x) => x.key === key);
    return o ? o.ajuste : 0;
  };

  /** Masa magra en kg a partir del peso y el % de grasa; null si falta el % o no es válido */
  function masaMagra(peso, grasaPct) {
    const p = Number(peso), g = Number(grasaPct);
    if (!(p > 0) || grasaPct === "" || grasaPct == null || !(g > 0) || g >= 70) return null;
    return p * (1 - g / 100);
  }

  /**
   * Calcula TMB, gasto total y kcal objetivo.
   * datos: {sexo:'hombre'|'mujer', edad, peso, altura, grasa (% opcional), actividad, objetivo, formula}
   * Con una fórmula de masa magra y sin % de grasa devuelve null.
   */
  function calcular(d) {
    const f = FORMULAS[d.formula] || FORMULAS.hb_revisada;
    const s = normSexo(d.sexo);
    const peso = Number(d.peso), altura = Number(d.altura), edad = Number(d.edad);
    const magra = masaMagra(peso, d.grasa);
    if (f.grasa && magra == null) return null;
    // Si el sexo no consta, se promedian ambas fórmulas en vez de asumir uno.
    const tmb = s === "indeterminado"
      ? (f.tmb("hombre", peso, altura, edad, magra) + f.tmb("mujer", peso, altura, edad, magra)) / 2
      : f.tmb(s, peso, altura, edad, magra);
    const factor = factorDe(d.actividad);
    const get = tmb * factor;                      // Gasto Energético Total
    const ajuste = ajusteDe(d.objetivo);
    const objetivo = get * (1 + ajuste);
    return {
      tmb: Math.round(tmb),
      factor,
      get: Math.round(get),
      ajuste,
      objetivo: Math.round(objetivo / 10) * 10,     // redondeo a 10 kcal
      formula: f.label,
      magra_kg: magra == null ? null : Math.round(magra * 10) / 10,
    };
  }

  /** Reparto de macros orientativo a partir de las kcal objetivo. */
  function macros(kcal, peso, objetivoKey) {
    // proteína por kg según objetivo
    const gkg = objetivoKey && objetivoKey.indexOf("deficit") === 0 ? 2.0
      : objetivoKey && objetivoKey.indexOf("superavit") === 0 ? 1.8 : 1.6;
    const prot = Math.round(peso * gkg);
    const grasa = Math.round((kcal * 0.28) / 9);   // ~28 % de las kcal
    const hc = Math.max(0, Math.round((kcal - prot * 4 - grasa * 9) / 4));
    return { proteinas_g: prot, grasas_g: grasa, hidratos_g: hc, prot_g_kg: gkg };
  }

  /** IMC y su clasificación (informativo). */
  function imc(peso, alturaCm) {
    const m = Number(alturaCm) / 100;
    if (!m) return null;
    const v = Number(peso) / (m * m);
    let cat = "Normopeso";
    if (v < 18.5) cat = "Bajo peso";
    else if (v < 25) cat = "Normopeso";
    else if (v < 30) cat = "Sobrepeso";
    else if (v < 35) cat = "Obesidad grado I";
    else if (v < 40) cat = "Obesidad grado II";
    else cat = "Obesidad grado III";
    return { valor: Math.round(v * 10) / 10, categoria: cat };
  }

  return { ACTIVIDAD, OBJETIVOS, FORMULAS, calcular, masaMagra, macros, imc, factorDe, ajusteDe, normSexo, edadDe };
})();
