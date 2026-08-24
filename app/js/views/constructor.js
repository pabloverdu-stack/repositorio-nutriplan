/* views/constructor.js — crear recetas propias a partir de alimentos simples (BEDCA) */
NP.views = NP.views || {};
NP.views.constructor = function (view) {
  const { el, fmt, toast, debounce } = NP.util;

  let ings = []; // [{f_id, nombre, g}]
  let editId = null;

  // ---- panel izquierdo: buscador de alimentos ----
  const search = el("input", { placeholder: "Buscar alimento (arroz, pollo, lechuga...)" });
  const results = el("div", { class: "results", hidden: true });
  search.addEventListener("input", debounce(() => {
    const q = search.value.trim();
    if (!q) { results.hidden = true; return; }
    const res = NP.data.buscarAlimentos(q, 25);
    results.innerHTML = "";
    if (!res.length) { results.appendChild(el("div", { class: "result-item muted" }, "Sin resultados")); }
    res.forEach((a) => results.appendChild(el("div", {
      class: "result-item", onclick: () => addIng(a),
    }, [
      el("div", {}, a.nombre),
      el("div", { class: "k" }, `${fmt(a.nut.energia_kcal)} kcal · P ${fmt(a.nut.proteinas_g, 1)} / H ${fmt(a.nut.hidratos_g, 1)} / G ${fmt(a.nut.grasas_g, 1)} (por 100 g)`),
    ])));
    results.hidden = false;
  }, 160));

  function addIng(a) {
    if (ings.find((i) => i.f_id === a.f_id)) { toast("Ya está en la receta"); return; }
    ings.push({ f_id: a.f_id, nombre: a.nombre, g: 100 });
    search.value = ""; results.hidden = true; render();
  }

  // ---- panel derecho: receta en construcción ----
  const nombreInp = el("input", { placeholder: "Nombre de la receta (ej. Arroz con pollo y ensalada)" });
  const tipoSel = el("select", {}, [
    ["comida_cena", "Comida / Cena"], ["desayuno", "Desayuno"], ["merienda", "Merienda"],
  ].map(([v, l]) => el("option", { value: v }, l)));
  const ingWrap = el("div", {});
  const totalsWrap = el("div", {});

  function render() {
    // filas de ingredientes
    ingWrap.innerHTML = "";
    if (!ings.length) ingWrap.appendChild(el("div", { class: "muted small", style: "padding:10px 0" }, "Añade alimentos desde el buscador de la izquierda."));
    ings.forEach((i, idx) => {
      const g = el("input", { type: "number", value: i.g, min: 0, step: 5 });
      g.addEventListener("input", () => { i.g = Number(g.value) || 0; renderTotals(); });
      ingWrap.appendChild(el("div", { class: "ing-row" }, [
        el("span", { class: "ing-nm" }, i.nombre),
        g, el("span", { class: "muted small" }, "g"),
        el("button", { class: "icon-btn", title: "Quitar", onclick: () => { ings.splice(idx, 1); render(); } }, "✕"),
      ]));
    });
    renderTotals();
  }

  function calcNut() {
    return NP.nutri.sumIngredientes(ings.map((i) => ({ f_id: i.f_id, g: i.g })), NP.data.catalogo);
  }
  function renderTotals() {
    const n = calcNut();
    totalsWrap.innerHTML = "";
    totalsWrap.appendChild(el("div", { class: "kpis" }, [
      kpi(fmt(n.energia_kcal), "kcal"), kpi(fmt(n.proteinas_g, 1) + " g", "Proteínas"),
      kpi(fmt(n.hidratos_g, 1) + " g", "Hidratos"), kpi(fmt(n.grasas_g, 1) + " g", "Grasas"),
    ]));
    totalsWrap.appendChild(NP.comp.macroBar(n));

    // Tabla completa siempre visible: calorías, macros, minerales y vitaminas
    totalsWrap.appendChild(el("div", { class: "toolbar", style: "margin:18px 0 4px" }, [
      el("h4", { class: "grow", style: "margin:0" }, "Conteo nutricional"),
      el("span", { class: "small muted" }, ings.length ? `total de ${ings.length} alimento(s)` : "sin alimentos"),
    ]));
    totalsWrap.appendChild(NP.comp.nutritionTable(n));
  }
  const kpi = (v, l) => el("div", { class: "kpi" }, [el("div", { class: "v" }, v), el("div", { class: "l" }, l)]);

  function guardar() {
    if (!nombreInp.value.trim()) { toast("Ponle nombre a la receta"); return; }
    if (!ings.length) { toast("Añade al menos un alimento"); return; }
    const n = calcNut();
    const receta = {
      id: editId || undefined, propia: true,
      nombre: nombreInp.value.trim(), tipo: tipoSel.value, dificultad: "facil", tiempo_min: 10, raciones: 1,
      ingredientes: ings.map((i) => ({ f_id: i.f_id, nombre: i.nombre, gramos: i.g, casera: "", bedca_nombre: i.nombre })),
      elaboracion: ["Receta creada por ingredientes simples.", "Pesa cada alimento y combínalos."],
      nutricion: n, nutrientes_incompletos: [],
    };
    NP.store.savePropia(receta);
    toast("Receta guardada ✓  (ya disponible en Recetas y en los planes)");
    ings = []; nombreInp.value = ""; editId = null; render(); renderPropias();
  }

  // lista de recetas propias existentes
  const propiasWrap = el("div", {});
  function renderPropias() {
    const list = NP.store.getPropias();
    propiasWrap.innerHTML = "";
    if (!list.length) return;
    propiasWrap.appendChild(el("h4", { style: "margin:22px 0 10px" }, `Tus recetas propias (${list.length})`));
    const grid = el("div", { class: "grid grid-cards" });
    list.forEach((r) => {
      const card = NP.comp.recipeCard(r, (rec) => NP.comp.recipeDetail(rec));
      const del = el("button", { class: "btn btn-sm btn-danger", style: "margin:0 12px 12px", onclick: (e) => { e.stopPropagation(); if (confirm("¿Borrar receta propia?")) { NP.store.deletePropia(r.id); renderPropias(); } } }, "Borrar");
      card.appendChild(del);
      grid.appendChild(card);
    });
    propiasWrap.appendChild(grid);
  }

  // layout
  const left = el("div", { class: "panel" }, [
    el("h4", { style: "margin-bottom:10px" }, "Alimentos (BEDCA)"),
    search, results,
    el("div", { class: "small muted", style: "margin-top:10px" }, "Base BEDCA: macros y micros por 100 g."),
  ]);
  const right = el("div", { class: "panel" }, [
    el("label", { class: "field" }, [el("span", {}, "Nombre de la receta"), nombreInp]),
    el("label", { class: "field" }, [el("span", {}, "Tipo de comida"), tipoSel]),
    el("h4", { style: "margin:6px 0 4px" }, "Ingredientes"),
    ingWrap,
    el("hr", { style: "border:none;border-top:1px solid var(--line-soft);margin:14px 0" }),
    totalsWrap,
    el("div", { style: "margin-top:16px;display:flex;justify-content:flex-end" }, [
      el("button", { class: "btn btn-primary", onclick: guardar }, "💾 Guardar receta"),
    ]),
  ]);

  const cols = el("div", { class: "row", style: "align-items:flex-start" }, [
    el("div", { style: "flex:1;min-width:280px" }, [left]),
    el("div", { style: "flex:1.3;min-width:300px" }, [right]),
  ]);
  view.appendChild(cols);
  view.appendChild(propiasWrap);
  render(); renderPropias();
};
