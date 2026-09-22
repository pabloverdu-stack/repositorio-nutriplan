/* grafica.js — gráficas de líneas en SVG, sin librerías externas.
   Se usan para ver la evolución del paciente (peso y grasa por revisión) y la
   progresión de cargas en el entrenamiento. El SVG se dibuja con un tamaño fijo
   y se escala con CSS, así que se ve bien en el móvil y en el PDF del navegador. */
NP.grafica = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const { fmt } = NP.util;

  const nodo = (tag, attrs = {}, hijos = []) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (Array.isArray(hijos) ? hijos : [hijos]).forEach((h) => {
      if (h != null) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h);
    });
    return n;
  };

  const fechaCorta = (ms) => new Date(ms).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  const fechaLarga = (ms) => new Date(ms).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  /** Extremos del eje con un poco de aire y redondeados para que las líneas guía queden limpias */
  function escala(valores) {
    let min = Math.min(...valores), max = Math.max(...valores);
    if (min === max) { min -= 1; max += 1; }
    const aire = (max - min) * 0.12;
    min -= aire; max += aire;
    const paso = Math.pow(10, Math.floor(Math.log10(max - min))) / 2;
    return { min: Math.floor(min / paso) * paso, max: Math.ceil(max / paso) * paso };
  }

  /**
   * opts: {
   *   series: [{ nombre, color, unidad, eje:"izq"|"der", dec, puntos:[{x:ms, y:num, nota}] }],
   *   alto, ancho, sinPuntos
   * }
   */
  function lineas(opts) {
    const series = (opts.series || []).filter((s) => s.puntos && s.puntos.length);
    if (!series.length) return null;

    const W = opts.ancho || 760;
    const H = opts.alto || 260;
    const hayDer = series.some((s) => s.eje === "der");
    const M = { t: 18, r: hayDer ? 46 : 16, b: 30, l: 46 };
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const xs = series.flatMap((s) => s.puntos.map((p) => p.x));
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x0 === x1) { x0 -= 86400000; x1 += 86400000; }
    const X = (v) => M.l + ((v - x0) / (x1 - x0)) * w;

    const ejes = {};
    ["izq", "der"].forEach((lado) => {
      const ss = series.filter((s) => (s.eje || "izq") === lado);
      if (!ss.length) return;
      const e = escala(ss.flatMap((s) => s.puntos.map((p) => p.y)));
      e.Y = (v) => M.t + h - ((v - e.min) / (e.max - e.min)) * h;
      e.color = ss[0].color;
      e.dec = ss[0].dec ?? 1;
      e.unidad = ss[0].unidad || "";
      ejes[lado] = e;
    });

    const svg = nodo("svg", { viewBox: `0 0 ${W} ${H}`, class: "gf", role: "img" });

    // Líneas guía horizontales y etiquetas de los ejes verticales
    const LINEAS = 4;
    for (let i = 0; i <= LINEAS; i++) {
      const y = M.t + (h / LINEAS) * i;
      svg.appendChild(nodo("line", { x1: M.l, y1: y, x2: M.l + w, y2: y, class: "gf-guia" }));
      ["izq", "der"].forEach((lado) => {
        const e = ejes[lado];
        if (!e) return;
        const v = e.max - ((e.max - e.min) / LINEAS) * i;
        svg.appendChild(nodo("text", {
          x: lado === "izq" ? M.l - 8 : M.l + w + 8, y: y + 4,
          "text-anchor": lado === "izq" ? "end" : "start",
          class: "gf-eje", fill: Object.keys(ejes).length > 1 ? e.color : null,
        }, fmt(v, e.dec)));
      });
    }

    // Fechas del eje horizontal (como mucho 6, sin amontonarse)
    const fechas = [...new Set(xs)].sort((a, b) => a - b);
    const salto = Math.ceil(fechas.length / 6);
    fechas.forEach((f, i) => {
      if (i % salto && i !== fechas.length - 1) return;
      svg.appendChild(nodo("text", { x: X(f), y: H - 9, "text-anchor": "middle", class: "gf-eje" }, fechaCorta(f)));
    });

    // Una línea por serie, con relleno suave bajo la primera
    series.forEach((s, idx) => {
      const e = ejes[s.eje === "der" ? "der" : "izq"];
      const pts = s.puntos.slice().sort((a, b) => a.x - b.x);
      const coords = pts.map((p) => `${X(p.x).toFixed(1)},${e.Y(p.y).toFixed(1)}`);
      if (idx === 0 && pts.length > 1) {
        svg.appendChild(nodo("polygon", {
          points: `${X(pts[0].x).toFixed(1)},${M.t + h} ${coords.join(" ")} ${X(pts[pts.length - 1].x).toFixed(1)},${M.t + h}`,
          fill: s.color, opacity: ".10",
        }));
      }
      svg.appendChild(nodo("polyline", { points: coords.join(" "), fill: "none", stroke: s.color, "stroke-width": 2.2,
        "stroke-linejoin": "round", "stroke-linecap": "round" }));
      if (!opts.sinPuntos) pts.forEach((p) => {
        const c = nodo("circle", { cx: X(p.x), cy: e.Y(p.y), r: 3.6, fill: "var(--surface)", stroke: s.color, "stroke-width": 2 });
        c.appendChild(nodo("title", {}, `${fechaLarga(p.x)} · ${fmt(p.y, s.dec ?? 1)} ${s.unidad || ""}`.trim() +
          (p.nota ? " · " + p.nota : "")));
        svg.appendChild(c);
      });
    });

    const leyenda = NP.util.el("div", { class: "gf-leyenda" }, series.map((s) =>
      NP.util.el("span", { class: "gf-lg" }, [
        NP.util.el("i", { style: "background:" + s.color }),
        s.nombre + (s.unidad ? " (" + s.unidad + ")" : ""),
      ])));

    return NP.util.el("div", { class: "gf-caja" }, [svg, leyenda]);
  }

  /** Aviso para cuando todavía no hay datos suficientes que dibujar */
  const vacia = (texto) => NP.util.el("div", { class: "gf-vacia" }, texto);

  return { lineas, vacia, fechaCorta, fechaLarga };
})();
