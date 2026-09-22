/* antropo.js — antropometría: pliegues cutáneos, perímetros y composición corporal.
   La fórmula de los 7 pliegues es la de Jackson & Pollock (hombres, 1978) y
   Jackson, Pollock & Ward (mujeres, 1980): con la suma de los 7 pliegues y la
   edad se estima la densidad corporal, y de ahí el % de grasa con Siri (1961). */
NP.antropo = (function () {

  // Los 7 pliegues, en el orden en que se suelen medir
  const PLIEGUES = [
    { key: "pectoral",     label: "Pectoral",      ayuda: "Diagonal, entre la axila y el pezón" },
    { key: "axilar",       label: "Axilar medio",  ayuda: "Vertical, en la línea media axilar a la altura del esternón" },
    { key: "triceps",      label: "Tríceps",       ayuda: "Vertical, en el punto medio entre hombro y codo" },
    { key: "subescapular", label: "Subescapular",  ayuda: "Diagonal, justo debajo del omóplato" },
    { key: "abdominal",    label: "Abdominal",     ayuda: "Vertical, a 2 cm del ombligo" },
    { key: "suprailiaco",  label: "Suprailíaco",   ayuda: "Diagonal, sobre la cresta ilíaca" },
    { key: "muslo",        label: "Muslo",         ayuda: "Vertical, en el punto medio entre cadera y rodilla" },
  ];

  // Perímetros que se anotan en la misma revisión (cm)
  const MEDIDAS = [
    { key: "cuello",  label: "Cuello" },
    { key: "pecho",   label: "Pecho" },
    { key: "cintura", label: "Cintura" },
    { key: "cadera",  label: "Cadera" },
    { key: "brazo",   label: "Brazo (relajado)" },
    { key: "muslo",   label: "Muslo" },
    { key: "gemelo",  label: "Gemelo" },
  ];

  const num = (v) => { const n = Number(v); return v === "" || v == null || isNaN(n) ? null : n; };

  /** Suma de los 7 pliegues en mm; null si falta alguno */
  function suma7(pliegues) {
    if (!pliegues) return null;
    let s = 0;
    for (const p of PLIEGUES) {
      const v = num(pliegues[p.key]);
      if (v == null || v <= 0) return null;
      s += v;
    }
    return Math.round(s * 10) / 10;
  }
  /** Cuántos pliegues quedan por medir (para avisar en el formulario) */
  const faltan = (pliegues) => PLIEGUES.filter((p) => !(num(pliegues && pliegues[p.key]) > 0)).length;

  /** Densidad corporal (g/cc) por Jackson-Pollock de 7 pliegues */
  function densidad(suma, edad, sexo) {
    const s = NP.calorias.normSexo(sexo);
    const hombre = 1.112 - 0.00043499 * suma + 0.00000055 * suma * suma - 0.00028826 * edad;
    const mujer = 1.097 - 0.00046971 * suma + 0.00000056 * suma * suma - 0.00012828 * edad;
    // Sin sexo registrado se promedian las dos, igual que hace el cálculo de calorías
    return s === "hombre" ? hombre : s === "mujer" ? mujer : (hombre + mujer) / 2;
  }

  /** Siri (1961): de densidad corporal a % de grasa */
  const siri = (dc) => 495 / dc - 450;

  /** % de grasa por los 7 pliegues.
   *  Devuelve {suma, densidad, grasa_pct} o null si faltan pliegues, edad o sexo. */
  function jacksonPollock7(pliegues, edad, sexo) {
    const suma = suma7(pliegues);
    if (suma == null || !(edad > 0)) return null;
    const dc = densidad(suma, edad, sexo);
    const pct = siri(dc);
    if (!(pct > 0) || pct > 70) return null; // medidas incoherentes
    return { suma, densidad: Math.round(dc * 100000) / 100000, grasa_pct: Math.round(pct * 10) / 10 };
  }

  /** Kg de grasa y de masa magra a partir del peso y el % de grasa */
  function composicion(peso, grasaPct) {
    const p = num(peso), g = num(grasaPct);
    if (p == null || g == null) return null;
    const grasa = (p * g) / 100;
    return { grasa_kg: Math.round(grasa * 10) / 10, magra_kg: Math.round((p - grasa) * 10) / 10 };
  }

  /** Clasificación orientativa del % de grasa (ACE) */
  function clasificar(pct, sexo) {
    if (pct == null) return "";
    const s = NP.calorias.normSexo(sexo);
    const cortes = s === "mujer" ? [13, 20, 24, 31] : [5, 13, 17, 25];
    const nombres = ["grasa esencial", "nivel atleta", "en forma", "aceptable", "obesidad"];
    return nombres[cortes.filter((c) => pct > c).length];
  }

  /** Índice cintura/cadera: riesgo cardiovascular orientativo */
  function cinturaCadera(cintura, cadera, sexo) {
    const c = num(cintura), h = num(cadera);
    if (!c || !h) return null;
    const v = Math.round((c / h) * 100) / 100;
    const s = NP.calorias.normSexo(sexo);
    const alto = s === "mujer" ? 0.85 : 0.9;
    return { valor: v, riesgo: v >= alto ? "riesgo elevado" : "riesgo bajo" };
  }

  return { PLIEGUES, MEDIDAS, suma7, faltan, densidad, siri, jacksonPollock7, composicion, clasificar, cinturaCadera };
})();
