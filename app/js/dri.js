/* dri.js — Valores de referencia de ingesta (cuánto hay que cubrir de cada nutriente)
 *
 * FUENTE OFICIAL (no inventada, transcrita de las tablas resumen publicadas):
 *   · EFSA — "Overview on Dietary Reference Values for the EU population", versión 4 (sept. 2017).
 *     Tablas 1-11: PRI (ingesta de referencia para la población), AI (ingesta adecuada),
 *     RI (rango de referencia para macronutrientes).
 *     https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf
 *   · EFSA — Dietary reference values for sodium (EFSA Journal 2019;17(9):5778): ingesta segura
 *     y adecuada de 2,0 g Na/día en adultos.
 *   · EFSA — "Overview on Tolerable Upper Intake Levels", versión 11 (agosto 2025): niveles
 *     máximos tolerables (UL) y niveles seguros de ingesta.
 *     https://www.efsa.europa.eu/sites/default/files/assets/UL_Summary_tables.pdf
 *   · OMS/FAO para los tres límites que EFSA deja como "lo más bajo posible" (grasa saturada,
 *     azúcares libres) y colesterol. Van marcados como "orientativo" en la ficha.
 *
 * Cada referencia devuelta tiene la forma:
 *   { min, max, tipo, fuente, nota, soloInfo }
 *   min → hay que llegar (por debajo = rojo);  max → no hay que pasarse (por encima = rojo)
 */
NP.dri = (function () {
  const KCAL_POR_MJ = 238.83; // 1 MJ = 238,83 kcal (EFSA, tabla 1)

  /* ---------- helpers de tabla ----------
     bandas: [[edadMáxima, valor], ...]; valor = número | {h: hombres, m: mujeres} */
  function valSexo(v, p) {
    if (typeof v === "number") return v;
    if (p.sexo === "hombre") return v.h;
    if (p.sexo === "mujer") return v.m;
    return Math.max(v.h, v.m); // sexo sin especificar: se toma el valor más exigente
  }
  function deBandas(bandas, p) {
    for (let i = 0; i < bandas.length; i++) if (p.edad <= bandas[i][0]) return valSexo(bandas[i][1], p);
    return valSexo(bandas[bandas.length - 1][1], p);
  }
  const esMujer = (p) => p.sexo !== "hombre"; // "otro"/sin dato entra por la rama más exigente
  const adulta = (p) => p.edad >= 18;

  const EFSA17 = "EFSA 2017";
  const EFSA19 = "EFSA 2019";
  const OMS = "OMS/FAO (orientativo)";

  /* ================== TABLA DE REFERENCIAS ==================
     tipo: PRI (cubre al 97,5 % de la población) | AI (ingesta adecuada) |
           IS (ingesta segura y adecuada) | RI (rango) | Objetivo | Orientativo   */
  const TABLA = {

    /* ---------- Energía y macronutrientes ---------- */
    energia_kcal: (p) => p.kcal && {
      min: Math.round(p.kcal * 0.88), max: Math.round(p.kcal * 1.12),
      tipo: "Objetivo", fuente: "Objetivo del paciente",
      nota: "Kcal objetivo del paciente con un margen de ±12 %.",
    },
    proteinas_g: (p) => p.peso && adulta(p) && {
      min: Math.round(0.83 * p.peso),
      tipo: "PRI", fuente: EFSA17,
      nota: "0,83 g por kg de peso corporal y día (adultos). Es el mínimo de seguridad: en " +
            "deporte o pérdida de grasa se suele trabajar por encima.",
    },
    grasas_g: (p) => p.kcal && {
      min: Math.round((p.kcal * 0.20) / 9), max: Math.round((p.kcal * 0.35) / 9),
      tipo: "RI", fuente: EFSA17,
      nota: "Rango de referencia: 20-35 % de la energía total.",
    },
    sat_g: (p) => p.kcal && {
      max: Math.round((p.kcal * 0.10) / 9),
      tipo: "Orientativo", fuente: OMS,
      nota: "EFSA no fija cifra: recomienda «lo más bajo posible». Se usa el límite OMS/FAO de " +
            "<10 % de la energía como referencia práctica.",
    },
    colesterol_mg: () => ({
      max: 300,
      tipo: "Orientativo", fuente: "Orientativo (consenso clínico)",
      nota: "EFSA no establece valor de referencia para el colesterol de la dieta. 300 mg/día es " +
            "el límite clásico que siguen usando las guías clínicas.",
    }),
    hidratos_g: (p) => p.kcal && {
      min: Math.round((p.kcal * 0.45) / 4), max: Math.round((p.kcal * 0.60) / 4),
      tipo: "RI", fuente: EFSA17,
      nota: "Rango de referencia: 45-60 % de la energía total.",
    },
    azucares_g: (p) => p.kcal && {
      max: Math.round((p.kcal * 0.10) / 4),
      tipo: "Orientativo", fuente: OMS,
      nota: "Límite OMS de <10 % de la energía, referido a azúcares LIBRES (añadidos, miel, zumos). " +
            "La cifra del plan son azúcares TOTALES e incluye los de fruta y lácteos, así que " +
            "superarla no significa necesariamente un exceso.",
    },
    fibra_g: (p) => ({
      min: deBandas([[3, 10], [6, 14], [10, 16], [14, 19], [17, 21], [999, 25]], p),
      tipo: "AI", fuente: EFSA17,
      nota: "25 g/día en adultos.",
    }),
    agua_g: (p) => ({
      min: 1000 * (p.estado === "embarazo" ? 2.3 : p.estado === "lactancia" ? 2.7
        : deBandas([[3, 1.2], [8, 1.6], [13, { h: 2.1, m: 1.9 }], [17, { h: 2.5, m: 2.0 }],
                    [999, { h: 2.5, m: 2.0 }]], p)),
      tipo: "AI", fuente: EFSA17, soloInfo: true,
      nota: "La ingesta adecuada de EFSA (2,5 L hombres / 2,0 L mujeres) es agua TOTAL: bebidas + " +
            "agua de los alimentos. Aquí solo se contabiliza el agua de los alimentos, por eso este " +
            "valor es informativo y no se marca en rojo.",
    }),

    /* ---------- Minerales ---------- */
    calcio_mg: (p) => ({
      min: deBandas([[3, 450], [10, 800], [17, 1150], [24, 1000], [999, 950]], p),
      max: adulta(p) ? 2500 : null,
      tipo: "PRI", fuente: EFSA17, nota: "UL (máximo tolerable) 2.500 mg/día en adultos.",
    }),
    hierro_mg: (p) => ({
      min: p.edad <= 6 ? 7
        : p.edad <= 11 ? 11
        : !esMujer(p) ? 11
        : (p.estado === "embarazo" || p.estado === "lactancia") ? 16
        : p.edad <= 17 ? 13
        : p.menopausia ? 11 : 16,
      max: adulta(p) ? 40 : null,
      tipo: "PRI", fuente: EFSA17,
      nota: "Mujer premenopáusica 16 mg/día; posmenopáusica y hombre, 11 mg/día. EFSA no fija UL: " +
            "40 mg/día es el nivel seguro de ingesta (2024).",
    }),
    magnesio_mg: (p) => ({
      min: deBandas([[2, 170], [9, 230], [17, { h: 300, m: 250 }], [999, { h: 350, m: 300 }]], p),
      tipo: "AI", fuente: EFSA17,
      nota: "El UL de 250 mg solo se aplica al magnesio de suplementos, no al de los alimentos.",
    }),
    fosforo_mg: (p) => ({
      min: deBandas([[3, 250], [10, 440], [17, 640], [999, 550]], p),
      tipo: "AI", fuente: EFSA17, nota: "Sin UL establecido.",
    }),
    potasio_mg: (p) => ({
      min: p.estado === "lactancia" ? 4000
        : deBandas([[3, 800], [6, 1100], [10, 1800], [14, 2700], [999, 3500]], p),
      tipo: "AI", fuente: EFSA17, nota: "Sin UL establecido. Lactancia: 4.000 mg/día.",
    }),
    sodio_mg: (p) => ({
      max: deBandas([[3, 1100], [6, 1300], [10, 1700], [999, 2000]], p),
      tipo: "IS", fuente: EFSA19,
      nota: "2,0 g de sodio al día (≈5 g de sal) es la ingesta segura y adecuada en adultos, " +
            "incluidos embarazo y lactancia. Es un techo, no un objetivo a alcanzar.",
    }),
    zinc_mg: (p) => {
      const extra = p.estado === "embarazo" ? 1.6 : p.estado === "lactancia" ? 2.9 : 0;
      const porFitatos = { 300: { h: 9.4, m: 7.5 }, 600: { h: 11.7, m: 9.3 },
                           900: { h: 14.0, m: 11.0 }, 1200: { h: 16.3, m: 12.7 } };
      const base = adulta(p)
        ? valSexo(porFitatos[p.fitatos] || porFitatos[600], p)
        : deBandas([[3, 4.3], [6, 5.5], [10, 7.4], [14, 10.7], [999, { h: 14.2, m: 11.9 }]], p);
      return {
        min: Math.round((base + extra) * 10) / 10,
        max: adulta(p) ? 25 : null,
        tipo: "PRI", fuente: EFSA17,
        nota: `La necesidad de zinc depende de los fitatos de la dieta (aquí, ${p.fitatos || 600} mg/día). ` +
              "Dieta mixta europea ≈600 mg; muy vegetariana o rica en integrales, 900-1.200 mg. UL 25 mg/día.",
      };
    },
    cobre_mg: (p) => ({
      min: (p.estado === "embarazo" || p.estado === "lactancia") ? 1.5
        : deBandas([[2, 0.7], [9, 1.0], [17, { h: 1.3, m: 1.1 }], [999, { h: 1.6, m: 1.3 }]], p),
      max: adulta(p) ? 5 : null,
      tipo: "AI", fuente: EFSA17, nota: "UL 5 mg/día en adultos.",
    }),
    manganeso_mg: (p) => ({
      min: deBandas([[3, 0.5], [6, 1.0], [10, 1.5], [14, 2.0], [999, 3.0]], p),
      max: adulta(p) ? 8 : null,
      tipo: "AI", fuente: EFSA17,
      nota: "EFSA no fija UL: 8 mg/día es el nivel seguro de ingesta (2023).",
    }),
    selenio_ug: (p) => ({
      min: p.estado === "lactancia" ? 85
        : deBandas([[3, 15], [6, 20], [10, 35], [14, 55], [999, 70]], p),
      max: adulta(p) ? 255 : null,
      tipo: "AI", fuente: EFSA17, nota: "UL 255 µg/día en adultos (EFSA 2023).",
    }),
    yodo_ug: (p) => ({
      min: (p.estado === "embarazo" || p.estado === "lactancia") ? 200
        : deBandas([[10, 90], [14, 120], [17, 130], [999, 150]], p),
      max: adulta(p) ? 600 : null,
      tipo: "AI", fuente: EFSA17, nota: "Embarazo y lactancia: 200 µg/día. UL 600 µg/día.",
    }),

    /* ---------- Vitaminas ---------- */
    vit_a_ug: (p) => ({
      min: p.estado === "embarazo" ? 700 : p.estado === "lactancia" ? 1300
        : deBandas([[3, 250], [6, 300], [10, 400], [14, 600], [17, { h: 750, m: 650 }],
                    [999, { h: 750, m: 650 }]], p),
      max: adulta(p) ? 3000 : null,
      tipo: "PRI", fuente: EFSA17,
      nota: "En µg de equivalentes de retinol. El UL de 3.000 µg/día se refiere a vitamina A " +
            "preformada (retinol), no al betacaroteno de vegetales.",
    }),
    vit_d_ug: () => ({
      min: 15, max: 100,
      tipo: "AI", fuente: EFSA17,
      nota: "15 µg/día suponiendo síntesis cutánea mínima; con exposición solar la necesidad " +
            "dietética baja. Casi ninguna dieta la cubre solo con alimentos. UL 100 µg/día.",
    }),
    vit_e_mg: (p) => ({
      min: (p.estado === "embarazo" || p.estado === "lactancia") ? 11
        : deBandas([[2, 6], [9, 9], [17, { h: 13, m: 11 }], [999, { h: 13, m: 11 }]], p),
      max: adulta(p) ? 300 : null,
      tipo: "AI", fuente: EFSA17,
      nota: "EFSA lo define como α-tocoferol; BEDCA da equivalentes de α-tocoferol, ligeramente " +
            "superiores. UL 300 mg/día.",
    }),
    vit_c_mg: (p) => ({
      min: p.estado === "embarazo" ? 105 : p.estado === "lactancia" ? 155
        : deBandas([[3, 20], [6, 30], [10, 45], [14, 70], [17, { h: 100, m: 90 }],
                    [999, { h: 110, m: 95 }]], p),
      tipo: "PRI", fuente: EFSA17, nota: "Sin UL establecido.",
    }),
    tiamina_mg: (p) => ({
      min: Math.round((0.1 * (p.kcal / KCAL_POR_MJ)) * 100) / 100,
      tipo: "PRI", fuente: EFSA17,
      nota: `0,1 mg por MJ de energía. Calculado sobre ${NP.util.fmt(p.kcal)} kcal/día. Sin UL.`,
    }),
    riboflavina_mg: (p) => ({
      min: p.estado === "embarazo" ? 1.9 : p.estado === "lactancia" ? 2.0
        : deBandas([[3, 0.6], [6, 0.7], [10, 1.0], [14, 1.4], [999, 1.6]], p),
      tipo: "PRI", fuente: EFSA17, nota: "Sin UL establecido.",
    }),
    niacina_mg: (p) => ({
      min: Math.round((1.6 * (p.kcal / KCAL_POR_MJ)) * 10) / 10,
      tipo: "PRI", fuente: EFSA17,
      nota: `1,6 mg de equivalentes de niacina (NE) por MJ. Calculado sobre ${NP.util.fmt(p.kcal)} kcal/día. ` +
            "BEDCA da el componente «equivalentes de niacina, totales», que ya incluye la niacina " +
            "obtenida del triptófano: la unidad coincide con la de EFSA. Sin UL para la niacina de " +
            "los alimentos (el límite de 10 mg es solo para el ácido nicotínico de suplementos).",
    }),
    pantotenico_mg: (p) => ({
      min: p.estado === "lactancia" ? 7 : deBandas([[10, 4], [999, 5]], p),
      tipo: "AI", fuente: EFSA17, nota: "Sin UL establecido.",
    }),
    vit_b6_mg: (p) => ({
      min: p.estado === "embarazo" ? 1.8 : p.estado === "lactancia" ? 1.7
        : deBandas([[3, 0.6], [6, 0.7], [10, 1.0], [14, 1.4], [17, { h: 1.7, m: 1.6 }],
                    [999, { h: 1.7, m: 1.6 }]], p),
      max: adulta(p) ? 12 : null,
      tipo: "PRI", fuente: EFSA17, nota: "UL 12 mg/día (EFSA 2023).",
    }),
    biotina_ug: (p) => ({
      min: p.estado === "lactancia" ? 45 : deBandas([[3, 20], [10, 25], [17, 35], [999, 40]], p),
      tipo: "AI", fuente: EFSA17, nota: "Sin UL establecido.",
    }),
    folato_ug: (p) => ({
      min: p.estado === "embarazo" ? 600 : p.estado === "lactancia" ? 500
        : deBandas([[3, 120], [6, 140], [10, 200], [14, 270], [999, 330]], p),
      tipo: "PRI", fuente: EFSA17,
      nota: "En µg de equivalentes dietéticos de folato (DFE). BEDCA da «folato total» de los " +
            "alimentos, que equivale a los DFE mientras no haya alimentos fortificados ni ácido " +
            "fólico. El UL de 1.000 µg solo se aplica al ácido fólico de suplementos y fortificados. " +
            "En embarazo se suplementa además según criterio clínico.",
    }),
    vit_b12_ug: (p) => ({
      min: p.estado === "embarazo" ? 4.5 : p.estado === "lactancia" ? 5.0
        : deBandas([[6, 1.5], [10, 2.5], [14, 3.5], [999, 4.0]], p),
      tipo: "AI", fuente: EFSA17, nota: "Sin efectos adversos definidos, no hay UL.",
    }),
  };

  const ETIQUETA_TIPO = {
    PRI: "PRI · ingesta de referencia (cubre al 97,5 % de la población)",
    AI: "AI · ingesta adecuada",
    IS: "Ingesta segura y adecuada",
    RI: "Rango de referencia",
    Objetivo: "Objetivo individual",
    Orientativo: "Valor orientativo",
  };

  /** Perfil fisiológico a partir del paciente. Devuelve siempre algo utilizable. */
  function perfil(pac) {
    const p = pac || {};
    const edad = NP.calorias.edadDe(p.fecha_nacimiento);
    const sexo = NP.calorias.normSexo(p.sexo); // "hombre" | "mujer" | "indeterminado"
    const dri = p.dri || {};
    return {
      sexo,
      edad: dri.edad || edad || 30,          // sin fecha de nacimiento se asume adulto de 30
      edadReal: edad,
      estado: dri.estado || "normal",        // normal | embarazo | lactancia
      menopausia: !!dri.menopausia,
      fitatos: dri.fitatos || 600,           // mg/día de fitatos (dieta mixta europea)
      kcal: Number(p.kcal_objetivo) || 2000,
      peso: Number(p.peso_kg) || null,
      sinPaciente: !pac,
    };
  }

  /** Texto corto que describe el perfil usado ("Mujer · 34 años · embarazo"). */
  function describir(p) {
    const s = p.sexo === "hombre" ? "Hombre" : p.sexo === "mujer" ? "Mujer" : "Sexo sin indicar";
    const t = [s, p.edad + " años"];
    if (p.estado === "embarazo") t.push("embarazo");
    if (p.estado === "lactancia") t.push("lactancia");
    if (p.sexo === "mujer" && p.estado === "normal" && p.edad >= 18) t.push(p.menopausia ? "posmenopausia" : "premenopausia");
    return t.join(" · ");
  }

  /**
   * Referencias de todos los nutrientes para un perfil.
   * factor: multiplica los valores (7 para ver el total de la semana).
   */
  function referencias(p, factor = 1) {
    const out = {};
    Object.keys(TABLA).forEach((k) => {
      let r;
      try { r = TABLA[k](p); } catch (e) { r = null; }
      if (!r) return;
      out[k] = {
        ...r,
        min: r.min != null ? redondear(r.min * factor) : null,
        max: r.max != null ? redondear(r.max * factor) : null,
        tipoLargo: ETIQUETA_TIPO[r.tipo] || r.tipo,
      };
    });
    return out;
  }
  const redondear = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

  /* Por debajo de esta cobertura de la tabla de composición el total no es comparable:
     el nutriente se marca "sin datos" en gris en vez de en rojo.
     El umbral está puesto en el hueco real de los datos de BEDCA: biotina, ácido pantoténico,
     manganeso, cobre y azúcares solo constan en un 4-17 % de los alimentos, mientras que el
     resto de nutrientes supera el 55 %. Así se filtra lo que no se puede medir sin tapar
     carencias reales (p. ej. la vitamina D, que sí está medida y casi nunca se cubre). */
  const MIN_COBERTURA = 0.4;

  /**
   * Compara un valor con su referencia.
   * cob: fracción 0..1 de los gramos del plan cuyo alimento tiene medido ese nutriente
   *      (NP.nutri.pctCobertura). Opcional.
   * → { estado: "bajo"|"ok"|"alto"|"info"|"sindatos", pct, cobertura }
   */
  function evaluar(valor, ref, cob) {
    const v = Number(valor) || 0;
    if (!ref) return null;
    // En un rango (20-35 % de la energía) el "% del mínimo" despista más que ayuda
    const esRango = ref.min != null && ref.max != null && (ref.tipo === "RI" || ref.tipo === "Objetivo");
    const pct = ref.min ? (v / ref.min) * 100 : ref.max ? (v / ref.max) * 100 : null;
    let estado = "ok";
    if (ref.soloInfo) estado = "info";
    else if (cob != null && cob < MIN_COBERTURA) estado = "sindatos";
    else if (ref.min != null && v < ref.min) estado = "bajo";
    else if (ref.max != null && v > ref.max) estado = "alto";
    return { estado, pct: esRango ? null : pct, cobertura: cob };
  }

  /** Texto del objetivo: "950 mg", "44–77 g", "≤ 2.000 mg". */
  function textoObjetivo(ref, unidad) {
    // 2 decimales por debajo de 1 (tiamina 0,84 mg), 1 hasta 10, ninguno por encima
    const n = (x) => NP.util.fmt(x, !(x % 1) ? 0 : x < 1 ? 2 : x < 10 ? 1 : 0);
    if (ref.min != null && ref.max != null && ref.tipo === "RI") return `${n(ref.min)}–${n(ref.max)} ${unidad}`;
    if (ref.min != null && ref.max != null && ref.tipo === "Objetivo") return `${n(ref.min)}–${n(ref.max)} ${unidad}`;
    if (ref.min != null) return `${n(ref.min)} ${unidad}`;
    if (ref.max != null) return `≤ ${n(ref.max)} ${unidad}`;
    return "";
  }

  /** Resumen: cuántos objetivos se cubren y cuáles fallan. */
  function resumen(nut, refs, cobs) {
    const bajos = [], altos = [], sinDatos = [];
    let total = 0, ok = 0;
    NP.nutri.TODOS.forEach(([k, label]) => {
      const r = refs[k];
      if (!r || r.soloInfo) return;
      const e = evaluar(nut[k], r, cobs ? cobs[k] : null);
      if (e.estado === "sindatos") { sinDatos.push(label); return; } // no se puede juzgar
      total++;
      if (e.estado === "bajo") bajos.push(label);
      else if (e.estado === "alto") altos.push(label);
      else ok++;
    });
    return { total, ok, bajos, altos, sinDatos };
  }

  const CREDITO =
    "Referencias EFSA (Dietary Reference Values, resumen v4 2017; sodio 2019; niveles máximos " +
    "tolerables v11 2025). Grasa saturada, azúcares y colesterol: límites orientativos OMS/FAO.";

  return { TABLA, perfil, describir, referencias, evaluar, textoObjetivo, resumen, CREDITO, ETIQUETA_TIPO };
})();
