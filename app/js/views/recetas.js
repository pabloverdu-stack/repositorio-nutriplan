/* views/recetas.js — componentes compartidos (NP.comp) + explorador de recetas */
NP.views = NP.views || {};

/* ---------- Componentes reutilizables ---------- */
NP.comp = (function () {
  const { el, fmt, modal } = NP.util;
  const EMO = { desayuno: "🥣", comida_cena: "🍽️", merienda: "🍎" };
  const LBL = { desayuno: "Desayuno", comida_cena: "Comida / Cena", merienda: "Merienda" };

  function macroBar(n) {
    const p = NP.nutri.macroPct(n);
    return el("div", {}, [
      el("div", { class: "macrobar" }, [
        el("span", { class: "mb-h", style: `width:${p.h}%` }),
        el("span", { class: "mb-p", style: `width:${p.p}%` }),
        el("span", { class: "mb-g", style: `width:${p.g}%` }),
      ]),
      el("div", { class: "macros" }, [
        el("span", { class: "m" }, [el("span", { class: "dot dot-h" }), `H ${fmt(n.hidratos_g, 0)} g`]),
        el("span", { class: "m" }, [el("span", { class: "dot dot-p" }), `P ${fmt(n.proteinas_g, 0)} g`]),
        el("span", { class: "m" }, [el("span", { class: "dot dot-g" }), `G ${fmt(n.grasas_g, 0)} g`]),
      ]),
    ]);
  }

  /** Botón de favorito (estrella). onToggle opcional: se llama tras cambiar. */
  function favBtn(r, onToggle) {
    const b = el("button", { class: "fav-btn", title: "Añadir a favoritas" });
    const pintar = () => {
      const f = NP.store.esFavorita(r.id);
      b.textContent = f ? "★" : "☆";
      b.classList.toggle("on", f);
      b.title = f ? "Quitar de favoritas" : "Añadir a favoritas";
    };
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const ahora = NP.store.toggleFavorita(r.id);
      pintar();
      NP.util.toast(ahora ? "★ Añadida a favoritas" : "Quitada de favoritas");
      onToggle && onToggle(ahora);
    });
    pintar();
    return b;
  }

  function recipeCard(r, onClick, onFavToggle) {
    return el("div", { class: "card" }, [
      el("div", { class: "card-thumb", onclick: () => onClick(r) }, [
        el("span", {}, EMO[r.tipo] || "🍴"),
        favBtn(r, onFavToggle),
      ]),
      el("div", { class: "card-body", onclick: () => onClick(r) }, [
        el("div", { class: "card-title" }, r.nombre),
        el("div", { class: "card-meta" }, [
          el("span", { class: "kcal" }, `${fmt(r.nutricion.energia_kcal)} kcal`),
          el("span", { class: "tag" }, r.propia ? "Propia" : LBL[r.tipo]),
        ]),
        macroBar(r.nutricion),
      ]),
    ]);
  }

  /**
   * Ficha de nutrientes.
   * refs (opcional): mapa clave → referencia de NP.dri.referencias(). Si se pasa, cada fila
   * muestra "consumido / objetivo" y se pinta en rojo si no llega (o si se pasa de un techo).
   */
  function nutritionTable(n, faltantes = [], refs = null, cobs = null) {
    const rows = [];
    const sec = (t) => rows.push(el("div", { class: "nut-sec" }, t));
    const row = (k, label, unit) => {
      const inc = faltantes.includes(k);
      const v = n[k];
      const txtV = `${fmt(v, (v % 1 ? 1 : 0))} ${unit}`;
      const ref = refs ? refs[k] : null;
      if (!ref) {
        rows.push(el("div", { class: "nut-row" }, [
          el("span", { class: "nm" }, label + (inc ? " *" : "")),
          el("span", { class: "vl" }, txtV),
        ]));
        return;
      }
      const cob = cobs ? cobs[k] : null;
      const ev = NP.dri.evaluar(v, ref, cob);
      const pct = ev.pct == null ? null : Math.round(ev.pct);
      const fila = el("div", {
        class: `nut-row has-ref ${ev.estado}`,
        title: [
          label + " — objetivo " + NP.dri.textoObjetivo(ref, unit),
          ref.tipoLargo + " · " + ref.fuente,
          ref.nota || "",
          ev.estado === "sindatos"
            ? `Sin datos suficientes: solo el ${Math.round(cob * 100)} % de los gramos del plan viene ` +
              "de alimentos con este nutriente medido en BEDCA, así que el total no es comparable " +
              "con el objetivo y no se marca en rojo."
            : "",
          inc ? "Ojo: algún ingrediente no tiene este dato en la tabla de composición, el total se queda corto." : "",
        ].filter(Boolean).join("\n"),
      }, [
        el("span", { class: "nm" }, label + (inc ? " *" : "")),
        // la unidad va una sola vez, en el objetivo: en 250 px cada carácter cuenta
        el("span", { class: "vl" }, [
          fmt(v, (v % 1 ? 1 : 0)), el("i", {}, " / " + NP.dri.textoObjetivo(ref, unit)),
        ]),
        el("span", { class: "pc" }, ev.estado === "sindatos" ? "s/d" : pct == null ? "" : pct + " %"),
        el("span", { class: "bar" }, [el("i", { style: `width:${Math.min(100, pct || 0)}%` })]),
      ]);
      rows.push(fila);
    };
    sec("Macronutrientes"); NP.nutri.MACROS.forEach(([k, l, u]) => row(k, l, u));
    sec("Minerales"); NP.nutri.MINERALES.forEach(([k, l, u]) => row(k, l, u));
    sec("Vitaminas"); NP.nutri.VITAMINAS.forEach(([k, l, u]) => row(k, l, u));
    const grid = el("div", { class: "nut-grid" }, rows);
    const wrap = el("div", {}, [grid]);
    if (refs) wrap.appendChild(el("div", { class: "nut-leyenda" }, [
      el("span", { class: "lg bajo" }, "No llega al objetivo"),
      el("span", { class: "lg alto" }, "Se pasa del límite"),
      el("span", { class: "lg ok" }, "Cubierto"),
      cobs ? el("span", { class: "lg sindatos" }, "s/d · la tabla de alimentos no lo mide") : null,
    ]));
    if (faltantes && faltantes.length) wrap.appendChild(el("div", { class: "small muted", style: "margin-top:10px" },
      "* Valor incompleto: algún ingrediente no tiene ese dato en BEDCA (se completaría con USDA)."));
    if (refs) wrap.appendChild(el("div", { class: "small muted", style: "margin-top:8px;line-height:1.45" },
      NP.dri.CREDITO));
    return wrap;
  }

  function recipeDetail(r) {
    const body = el("div", {}, [
      el("div", { class: "row", style: "margin-bottom:14px" }, [
        el("div", {}, [
          el("div", { class: "muted small" }, "Tipo"),
          el("div", {}, LBL[r.tipo] || r.tipo),
        ]),
        el("div", {}, [el("div", { class: "muted small" }, "Dificultad"), el("div", {}, r.dificultad || "—")]),
        el("div", {}, [el("div", { class: "muted small" }, "Tiempo"), el("div", {}, (r.tiempo_min || "—") + " min")]),
        el("div", {}, [el("div", { class: "muted small" }, "Energía"), el("div", { class: "kcal", style: "font-size:16px" }, fmt(r.nutricion.energia_kcal) + " kcal")]),
      ]),
      macroBar(r.nutricion),
      el("h4", { style: "margin:18px 0 8px" }, "Ingredientes"),
      el("div", {}, (r.ingredientes || []).map((i) =>
        el("div", { class: "nut-row" }, [
          el("span", { class: "nm" }, i.nombre + (i.casera ? ` · ${i.casera}` : "")),
          el("span", { class: "vl" }, `${i.gramos} g`),
        ]))),
      el("h4", { style: "margin:18px 0 8px" }, "Elaboración"),
      el("ol", { style: "margin:0; padding-left:18px; color:var(--text)" },
        (r.elaboracion || []).map((s) => el("li", { style: "margin-bottom:6px" }, s))),
      el("h4", { style: "margin:18px 0 8px" }, "Información nutricional"),
      nutritionTable(r.nutricion, r.nutrientes_incompletos || []),
    ]);
    return modal({ title: r.nombre, body, wide: true });
  }

  // Selector de receta con búsqueda (usado por el plan). onPick(receta)
  // onAlimentos (opcional): si se pasa, muestra un botón para añadir alimentos sueltos.
  function recipePicker({ tipo, title, onPick, onAlimentos, onAlimentoRapido }) {
    const { el } = NP.util;
    let soloFav = false;
    const q = el("input", { placeholder: "Buscar receta...", class: "grow" });
    const grid = el("div", { class: "grid grid-cards" });
    const info = el("div", { class: "small muted", style: "margin-bottom:10px" });

    const seg = el("div", { class: "seg", style: "flex:0 0 auto" }, [
      el("button", { class: "active", onclick: (e) => setFav(false, e.target) }, "Todas"),
      el("button", { onclick: (e) => setFav(true, e.target) }, "★ Favoritas"),
    ]);
    function setFav(v, btn) {
      soloFav = v;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      refresh();
    }

    const LIMITE = 120;
    function refresh() {
      grid.innerHTML = "";
      const res = NP.data.buscarRecetas({ q: q.value, tipo, limite: LIMITE, soloFav });
      const nFav = NP.store.getFavoritas().length;
      // Al llegar al tope hay más recetas de las que se ven: se avisa para no dar por hecho que son todas
      const tope = res.length === LIMITE ? "+ (afina la búsqueda)" : "";
      info.textContent = soloFav
        ? `${res.length} favorita(s) de este tipo${tope}`
        : `${res.length} receta(s)${tope} · ${nFav} favorita(s) guardadas`;
      if (!res.length) {
        grid.appendChild(el("div", { class: "empty" }, soloFav
          ? "Aún no tienes favoritas de este tipo. Marca recetas con ☆ para tenerlas a mano."
          : "Sin resultados."));
        return;
      }
      res.forEach((r) => {
        const card = recipeCard(r,
          (rec) => { m.close(); onPick(rec, 1, "M"); },
          () => { if (soloFav) refresh(); });
        // Tamaño de ración: escala los gramos de todos los ingredientes
        card.appendChild(el("div", { class: "size-pick" },
          NP.TAMANOS.map((t) => el("button", {
            class: "btn btn-sm" + (t.key === "M" ? " btn-primary" : ""),
            title: `${t.label} · ${Math.round(r.nutricion.energia_kcal * t.factor)} kcal`,
            onclick: (e) => { e.stopPropagation(); m.close(); onPick(r, t.factor, t.key); },
          }, [
            el("b", {}, t.key),
            el("span", { class: "sz-k" }, Math.round(r.nutricion.energia_kcal * t.factor) + " kcal"),
          ]))));
        grid.appendChild(card);
      });
    }
    q.addEventListener("input", NP.util.debounce(refresh, 150));
    const toolbar = [q, seg];
    if (onAlimentoRapido) toolbar.push(el("button", { class: "btn btn-primary", style: "flex:0 0 auto", title: "Un solo alimento: plátano, yogur, almendras...", onclick: () => { m.close(); onAlimentoRapido(); } }, "🍌 Un alimento"));
    if (onAlimentos) toolbar.push(el("button", { class: "btn", style: "flex:0 0 auto", title: "Varios alimentos combinados", onclick: () => { m.close(); onAlimentos(); } }, "🥗 Varios alimentos"));
    const body = el("div", {}, [el("div", { class: "toolbar" }, toolbar), info, grid]);
    const m = modal({ title: title || "Elegir receta", body, wide: true });
    refresh();
    return m;
  }

  return { macroBar, recipeCard, nutritionTable, recipeDetail, recipePicker, LBL, EMO };
})();

/* ---------- Constructor rápido de "alimentos sueltos" (reutilizable) ---------- */
NP.comp.builderAlimentos = function ({ title, inicial = [], nombre = "", onSave }) {
  const { el, fmt, toast, debounce } = NP.util;
  let ings = inicial.map((i) => ({ f_id: i.f_id, nombre: i.nombre, gramos: Number(i.gramos) || 100, casera: i.casera || "" }));

  const nombreInp = el("input", { value: nombre, placeholder: "Se pone solo con los alimentos que añadas" });
  const search = el("input", { placeholder: "Buscar alimento (pollo, arroz, lechuga...)" });
  const results = el("div", { class: "results", hidden: true });
  const rowsWrap = el("div", {});
  const totalsWrap = el("div", {});

  const calc = () => NP.nutri.sumIngredientes(ings.map((i) => ({ f_id: i.f_id, g: i.gramos })), NP.data.catalogo);

  search.addEventListener("input", debounce(() => {
    const query = search.value.trim();
    if (!query) { results.hidden = true; return; }
    const res = NP.data.buscarAlimentos(query, 25);
    results.innerHTML = "";
    if (!res.length) results.appendChild(el("div", { class: "result-item muted" }, "Sin resultados"));
    res.forEach((a) => results.appendChild(el("div", { class: "result-item", onclick: () => addIng(a) }, [
      el("div", {}, a.nombre),
      el("div", { class: "k" }, `${fmt(a.nut.energia_kcal)} kcal · P ${fmt(a.nut.proteinas_g, 1)} / H ${fmt(a.nut.hidratos_g, 1)} / G ${fmt(a.nut.grasas_g, 1)} (100 g)`),
    ])));
    results.hidden = false;
  }, 160));

  function addIng(a) {
    if (ings.find((i) => i.f_id === a.f_id)) { toast("Ya está añadido"); return; }
    ings.push({ f_id: a.f_id, nombre: a.nombre, gramos: 100, casera: "" });
    search.value = ""; results.hidden = true; resetTamano(); renderRows(); renderTotals();
  }
  function renderRows() {
    rowsWrap.innerHTML = "";
    if (!ings.length) rowsWrap.appendChild(el("div", { class: "muted small", style: "padding:8px 0" }, "Busca y añade alimentos con sus gramos."));
    ings.forEach((i, idx) => {
      const g = el("input", { type: "number", value: i.gramos, min: 0, step: 5 });
      g.addEventListener("input", () => { i.gramos = Number(g.value) || 0; resetTamano(); renderTotals(); });
      rowsWrap.appendChild(el("div", { class: "ing-row" }, [
        el("span", { class: "ing-nm" }, i.nombre),
        g, el("span", { class: "muted small" }, "g"),
        el("button", { class: "icon-btn", title: "Quitar", onclick: () => { ings.splice(idx, 1); resetTamano(); renderRows(); renderTotals(); } }, "✕"),
      ]));
    });
  }

  /* Tamaño de ración S/M/XL: escala de golpe todos los gramos.
     Se recuerda el factor aplicado, así S → XL parte de la ración normal.
     Tocar gramos a mano (o añadir/quitar alimentos) convierte lo que hay
     en la nueva ración normal. */
  let factorActual = 1;
  const tamBtns = {}, tamKcal = {};
  function marcarTamano() {
    NP.TAMANOS.forEach((t) => tamBtns[t.key].classList.toggle("btn-primary", t.factor === factorActual));
  }
  function resetTamano() { factorActual = 1; marcarTamano(); }
  function aplicarTamano(t) {
    if (!ings.length) { toast("Añade primero algún alimento"); return; }
    const f = t.factor / factorActual;
    ings.forEach((i) => (i.gramos = Math.round(i.gramos * f)));
    factorActual = t.factor;
    marcarTamano(); renderRows(); renderTotals();
  }
  const tamanoRow = el("div", { class: "row", style: "align-items:center;margin:10px 0 2px" }, [
    el("span", { class: "muted small", style: "flex:0 0 auto" }, "Tamaño de ración:"),
    el("div", { class: "size-pick", style: "flex:0 0 auto;padding:0" }, NP.TAMANOS.map((t) => {
      const k = el("span", { class: "sz-k" }, "—");
      const b = el("button", {
        class: "btn btn-sm" + (t.factor === 1 ? " btn-primary" : ""), title: t.label,
        onclick: () => aplicarTamano(t),
      }, [el("b", {}, t.key), k]);
      tamBtns[t.key] = b; tamKcal[t.key] = k;
      return b;
    })),
  ]);
  function renderTotals() {
    const n = calc();
    const kpi = (v, l) => el("div", { class: "kpi" }, [el("div", { class: "v" }, v), el("div", { class: "l" }, l)]);
    totalsWrap.innerHTML = "";
    totalsWrap.appendChild(el("div", { class: "kpis" }, [
      kpi(fmt(n.energia_kcal), "kcal"), kpi(fmt(n.proteinas_g, 1) + " g", "Proteínas"),
      kpi(fmt(n.hidratos_g, 1) + " g", "Hidratos"), kpi(fmt(n.grasas_g, 1) + " g", "Grasas"),
    ]));
    totalsWrap.appendChild(NP.comp.macroBar(n));
    // Tabla completa a la vista: calorías, macros, minerales y vitaminas
    totalsWrap.appendChild(el("div", { class: "toolbar", style: "margin:18px 0 4px" }, [
      el("h4", { class: "grow", style: "margin:0" }, "Conteo nutricional"),
      el("span", { class: "small muted" }, ings.length ? `total de ${ings.length} alimento(s)` : "sin alimentos"),
    ]));
    totalsWrap.appendChild(NP.comp.nutritionTable(n));
    // kcal que quedarían con cada tamaño de ración
    NP.TAMANOS.forEach((t) => {
      tamKcal[t.key].textContent = ings.length
        ? Math.round((n.energia_kcal || 0) * t.factor / factorActual) + " kcal" : "—";
    });
  }
  // Si no se pone nombre, se compone con los propios alimentos
  function nombreAuto(l) {
    if (!l.length) return "";
    if (l.length === 1) return l[0].nombre;
    if (l.length === 2) return `${l[0].nombre} y ${l[1].nombre}`;
    return `${l[0].nombre}, ${l[1].nombre} y ${l.length - 2} más`;
  }
  function guardar() {
    if (!ings.length) { toast("Añade al menos un alimento"); return; }
    onSave(ings.map((i) => ({ f_id: i.f_id, nombre: i.nombre, gramos: i.gramos, casera: i.casera })),
      calc(), nombreInp.value.trim() || nombreAuto(ings));
    m.close();
  }

  const body = el("div", {}, [
    el("label", { class: "field" }, [el("span", {}, "Nombre de la comida (opcional)"), nombreInp]),
    search, results,
    el("h4", { style: "margin:14px 0 6px" }, "Alimentos"),
    tamanoRow, rowsWrap,
    el("hr", { style: "border:none;border-top:1px solid var(--line-soft);margin:12px 0" }),
    totalsWrap,
  ]);
  const m = NP.util.modal({
    title: title || "Añadir alimentos sueltos", body, wide: true,
    footer: [
      el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
      el("button", { class: "btn btn-primary", onclick: guardar }, "Guardar comida"),
    ],
  });
  renderRows(); renderTotals();
  return m;
};

/* ---------- Añadir UN alimento suelto, en dos clics ----------
   Para lo cotidiano: un plátano, un yogur, un puñado de almendras.
   No pide nombre: el plato se llama como el alimento. */
NP.comp.alimentoRapido = function ({ title, onSave }) {
  const { el, fmt, toast, debounce } = NP.util;

  const search = el("input", { placeholder: "Buscar alimento (plátano, yogur, almendras...)" });
  const results = el("div", {});
  const ayuda = el("div", { class: "small muted", style: "margin:10px 0 4px" },
    "Escribe el alimento y pulsa ＋. La cantidad va a 100 g: cámbiala antes si quieres.");

  function añadir(a, gramos) {
    const g = Number(gramos) || 0;
    if (g <= 0) { toast("Pon una cantidad en gramos"); return; }
    const nut = NP.nutri.sumIngredientes([{ f_id: a.f_id, g }], NP.data.catalogo);
    onSave([{ f_id: a.f_id, nombre: a.nombre, gramos: g, casera: "" }], nut, a.nombre);
    m.close();
  }

  function pintar() {
    const q = search.value.trim();
    results.innerHTML = "";
    if (!q) return;
    const res = NP.data.buscarAlimentos(q, 25);
    if (!res.length) { results.appendChild(el("div", { class: "muted small", style: "padding:10px 0" }, "Sin resultados")); return; }
    res.forEach((a) => {
      const gr = el("input", { type: "number", value: 100, min: 1, step: 5, style: "width:78px;flex:0 0 auto" });
      gr.addEventListener("keydown", (e) => { if (e.key === "Enter") añadir(a, gr.value); });
      results.appendChild(el("div", { class: "ing-row" }, [
        el("span", { class: "ing-nm" }, [
          el("div", {}, a.nombre),
          el("div", { class: "small muted" }, `${fmt(a.nut.energia_kcal)} kcal · P ${fmt(a.nut.proteinas_g, 1)} / H ${fmt(a.nut.hidratos_g, 1)} / G ${fmt(a.nut.grasas_g, 1)} por 100 g`),
        ]),
        gr, el("span", { class: "muted small" }, "g"),
        el("button", { class: "btn btn-sm btn-primary", style: "flex:0 0 auto", onclick: () => añadir(a, gr.value) }, "＋"),
      ]));
    });
  }
  search.addEventListener("input", debounce(pintar, 160));

  const m = NP.util.modal({
    title: title || "Añadir un alimento",
    body: el("div", {}, [search, ayuda, results]),
    footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cerrar")],
  });
  setTimeout(() => search.focus(), 60);
  return m;
};

/* ---------- Vista: explorador de recetas ---------- */
NP.views.recetas = function (view) {
  const { el } = NP.util;
  let estado = { q: "", tipo: "", soloFav: false, soloPropias: false };

  const grid = el("div", { class: "grid grid-cards" });
  const q = el("input", { placeholder: "Buscar entre 3.000 recetas...", class: "grow" });
  q.addEventListener("input", NP.util.debounce(() => { estado.q = q.value; refresh(); }, 150));

  const seg = el("div", { class: "seg" }, [
    ["", "Todas"], ["desayuno", "Desayunos"], ["comida_cena", "Comidas/Cenas"], ["merienda", "Meriendas"],
  ].map(([val, lbl]) => el("button", {
    class: val === estado.tipo ? "active" : "",
    onclick: (e) => { estado.tipo = val; [...seg.children].forEach((b) => b.classList.remove("active")); e.target.classList.add("active"); refresh(); },
  }, lbl)));

  const info = el("span", { class: "muted small" });

  const favToggle = el("button", { class: "btn", title: "Ver solo las recetas marcadas con ★", onclick: () => {
    estado.soloFav = !estado.soloFav;
    favToggle.classList.toggle("btn-primary", estado.soloFav);
    favToggle.textContent = estado.soloFav ? "★ Viendo favoritas" : "☆ Favoritas";
    refresh();
  } }, "☆ Favoritas");

  // Recetas creadas por el propio nutricionista (las del constructor)
  const propiasToggle = el("button", { class: "btn", title: "Ver solo las recetas que has creado tú", onclick: () => {
    estado.soloPropias = !estado.soloPropias;
    propiasToggle.classList.toggle("btn-primary", estado.soloPropias);
    propiasToggle.textContent = estado.soloPropias ? "✎ Viendo mis recetas" : "✎ Mis recetas";
    refresh();
  } }, "✎ Mis recetas");

  function refresh() {
    const res = NP.data.buscarRecetas({ q: estado.q, tipo: estado.tipo, limite: 120, soloFav: estado.soloFav, soloPropias: estado.soloPropias });
    const nFav = NP.store.getFavoritas().length;
    const nProp = NP.store.getPropias().length;
    info.textContent = `${res.length} resultado(s)` + (res.length === 120 ? "+ (afina la búsqueda)" : "") +
      ` · ${nFav} favorita(s) · ${nProp} propia(s)`;
    grid.innerHTML = "";
    res.forEach((r) => grid.appendChild(NP.comp.recipeCard(r,
      (rec) => NP.comp.recipeDetail(rec),
      () => { if (estado.soloFav) refresh(); else info.textContent = info.textContent.replace(/\d+ favorita/, NP.store.getFavoritas().length + " favorita"); })));
    if (!res.length) grid.appendChild(el("div", { class: "empty" },
      estado.soloPropias && !nProp
        ? "Aún no has creado ninguna receta. Ve a Constructor para crear la primera."
        : estado.soloPropias
          ? "Ninguna de tus recetas encaja con este filtro."
          : estado.soloFav
            ? "Aún no tienes recetas favoritas. Pulsa ☆ en cualquier receta para guardarla aquí."
            : "Sin resultados."));
  }

  view.appendChild(el("div", { class: "toolbar" }, [q, seg, favToggle, propiasToggle]));
  view.appendChild(el("div", { style: "margin-bottom:12px" }, [info]));
  view.appendChild(grid);
  refresh();
};
