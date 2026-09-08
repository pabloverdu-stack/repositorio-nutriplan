/* views/plan.js — editor de plan semanal + recetas de cambio */
NP.views = NP.views || {};

// Config del plan (días y comidas). "cena" comparte pool con "comida".
NP.DIAS = [
  { key: "lunes", label: "Lun" }, { key: "martes", label: "Mar" }, { key: "miercoles", label: "Mié" },
  { key: "jueves", label: "Jue" }, { key: "viernes", label: "Vie" }, { key: "sabado", label: "Sáb" },
  { key: "domingo", label: "Dom" },
];
NP.COMIDAS = [
  { key: "desayuno", label: "Desayuno", tipo: "desayuno" },
  { key: "comida", label: "Comida", tipo: "comida_cena" },
  { key: "merienda", label: "Merienda", tipo: "merienda" },
  { key: "cena", label: "Cena", tipo: "comida_cena" },
];
// Tamaños de ración: escalan los gramos de todos los ingredientes de la receta
NP.TAMANOS = [
  { key: "S", label: "Ración pequeña", factor: 0.75 },
  { key: "M", label: "Ración normal", factor: 1 },
  { key: "XL", label: "Ración grande", factor: 1.4 },
];
NP.DIA_LARGO = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
  viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};
NP.nuevoPlan = function (pacienteId, nombre) {
  const comidas = NP.COMIDAS.map((c) => ({ ...c }));
  const dias = {};
  NP.DIAS.forEach((d) => { dias[d.key] = {}; comidas.forEach((c) => (dias[d.key][c.key] = null)); });
  return { pacienteId, nombre, comidas, dias };
};

/* ---------- Huecos del plan ----------
   Cada hueco (día × comida) guarda una LISTA de platos: p. ej. arroz con pollo + ensalada.
   Un plato es { kind:"receta", refId, custom? } o { kind:"alimentos", nombre, ingredientes, nutricion }.
   Los planes guardados antes de esto tenían un único plato suelto: se normalizan al vuelo.
   Estos helpers los usan también pdf.js, pacientes.js y mensajes.js. */
NP.slot = {
  // Lista de platos del hueco (array vacío si está libre)
  lista: (slot) => (!slot ? [] : Array.isArray(slot) ? slot : [slot]),

  // Convierte un plato guardado en su comida efectiva (nombre, ingredientes y nutrición ya resueltos)
  comida(item, tipo) {
    if (!item) return null;
    if (item.kind === "alimentos") {
      return {
        id: null, nombre: item.nombre || "Alimentos sueltos", tipo: tipo || "comida_cena",
        dificultad: "—", tiempo_min: "",
        ingredientes: item.ingredientes, nutricion: item.nutricion,
        elaboracion: ["Comida a base de alimentos sueltos (pesa cada uno)."],
        nutrientes_incompletos: [], _alimentos: true,
      };
    }
    const base = NP.data.getReceta(item.refId);
    if (!base) return null;
    if (item.custom) {
      return {
        ...base,
        nombre: base.nombre + (item.tamano && item.tamano !== "M" ? ` · ${item.tamano}` : ""),
        ingredientes: item.custom.ingredientes, nutricion: item.custom.nutricion, _ajustada: true,
      };
    }
    return base;
  },

  // Receta con todos sus gramos multiplicados por un factor (tamaños S/M/XL)
  escalar(receta, factor) {
    const ingredientes = receta.ingredientes.map((i) => ({
      ...i, gramos: Math.round((Number(i.gramos) || 0) * factor),
    }));
    return {
      nombre: receta.nombre,
      ingredientes,
      nutricion: NP.nutri.sumIngredientes(
        ingredientes.map((i) => ({ f_id: i.f_id, g: i.gramos })), NP.data.catalogo),
    };
  },

  // Comidas efectivas de todos los platos del hueco (descarta recetas que ya no existan)
  comidas(slot, tipo) {
    return NP.slot.lista(slot).map((i) => NP.slot.comida(i, tipo)).filter(Boolean);
  },

  // Nutrición completa del hueco = suma de sus platos
  nutricion(slot, tipo) {
    return NP.nutri.sumNutriciones(NP.slot.comidas(slot, tipo).map((c) => c.nutricion));
  },
  kcal(slot, tipo) {
    return NP.slot.comidas(slot, tipo).reduce((s, c) => s + (c.nutricion.energia_kcal || 0), 0);
  },
};

NP.views.plan = function (view, planId) {
  const { el, fmt, toast } = NP.util;
  const plan = NP.store.getPlan(planId);
  if (!plan) { NP.app.go("#/pacientes"); return; }
  const pac = NP.store.getPaciente(plan.pacienteId);
  NP.app.setTitle(plan.nombre + (pac ? " · " + pac.nombre : ""));
  const DIA_LARGO = NP.DIA_LARGO;

  const save = () => NP.store.savePlan(plan);

  // Comidas configurables por plan (migración de planes antiguos)
  if (!Array.isArray(plan.comidas)) plan.comidas = NP.COMIDAS.map((c) => ({ ...c }));
  function ensureDias() {
    NP.DIAS.forEach((d) => {
      if (!plan.dias[d.key]) plan.dias[d.key] = {};
      plan.comidas.forEach((c) => {
        const s = plan.dias[d.key][c.key];
        if (s === undefined) { plan.dias[d.key][c.key] = null; return; }
        // Planes antiguos: un plato suelto -> lista de un plato
        if (s && !Array.isArray(s)) plan.dias[d.key][c.key] = [s];
      });
    });
  }
  ensureDias();

  const platos = (day, meal) => NP.slot.lista(plan.dias[day][meal]);
  const tipoDeComida = (meal) => (plan.comidas.find((c) => c.key === meal) || {}).tipo || "comida_cena";

  // ---- Escritura de los platos de un hueco ----
  function setPlatos(day, meal, lista) {
    plan.dias[day][meal] = lista.length ? lista : null; // hueco sin platos = null
    save(); rerender();
  }
  const addPlato = (day, meal, item) => setPlatos(day, meal, platos(day, meal).concat([item]));
  function setPlato(day, meal, idx, item) {
    const l = platos(day, meal).slice(); l[idx] = item; setPlatos(day, meal, l);
  }
  function quitarPlato(day, meal, idx) {
    const l = platos(day, meal).slice(); l.splice(idx, 1); setPlatos(day, meal, l);
  }

  // Elegir receta. idx === null -> añade un plato más; idx numérico -> sustituye ese plato.
  function elegirPlato(day, meal, comida, idx) {
    const nuevo = idx == null;
    NP.comp.recipePicker({
      tipo: comida.tipo,
      title: `${nuevo ? "Añadir plato a" : "Cambiar plato de"} ${comida.label.toLowerCase()} · ${DIA_LARGO[day] || day}`,
      onPick: (r, factor, tamano) => {
        const item = { kind: "receta", refId: r.id, alternativas: [] };
        if (factor && factor !== 1) {           // S o XL: se guardan los gramos ya escalados
          item.custom = NP.slot.escalar(r, factor);
          item.tamano = tamano;
        }
        const sufijo = tamano && tamano !== "M" ? ` (${tamano})` : "";
        if (nuevo) { addPlato(day, meal, item); toast("Plato añadido" + sufijo); }
        else { setPlato(day, meal, idx, item); toast("Plato cambiado" + sufijo); }
      },
      onAlimentos: () => elegirAlimentos(day, meal, comida, idx),
      onAlimentoRapido: () => alimentoSuelto(day, meal, comida, idx),
    });
  }

  // Un único alimento (plátano, yogur...): el plato toma el nombre del alimento
  function alimentoSuelto(day, meal, comida, idx) {
    const nuevo = idx == null;
    NP.comp.alimentoRapido({
      title: `Alimento suelto · ${comida.label.toLowerCase()} · ${DIA_LARGO[day] || day}`,
      onSave: (ings, nut, nombre) => {
        const item = { kind: "alimentos", nombre, ingredientes: ings, nutricion: nut };
        if (nuevo) addPlato(day, meal, item); else setPlato(day, meal, idx, item);
        toast(nombre + " añadido");
      },
    });
  }

  // Alimentos sueltos como plato del hueco
  function elegirAlimentos(day, meal, comida, idx) {
    const nuevo = idx == null;
    NP.comp.builderAlimentos({
      title: `Alimentos · ${comida.label.toLowerCase()} · ${DIA_LARGO[day] || day}`,
      onSave: (ings, nut, nombre) => {
        const item = { kind: "alimentos", nombre: nombre || "Alimentos sueltos", ingredientes: ings, nutricion: nut };
        if (nuevo) addPlato(day, meal, item); else setPlato(day, meal, idx, item);
        toast("Alimentos añadidos");
      },
    });
  }
  function editarAlimentos(day, meal, idx) {
    const s = platos(day, meal)[idx];
    NP.comp.builderAlimentos({
      title: "Editar alimentos", inicial: s.ingredientes, nombre: s.nombre === "Alimentos sueltos" ? "" : s.nombre,
      onSave: (ings, nut, nombre) => {
        setPlato(day, meal, idx, { kind: "alimentos", nombre: nombre || "Alimentos sueltos", ingredientes: ings, nutricion: nut });
        toast("Alimentos actualizados");
      },
    });
  }

  // Recetas de cambio: alternativas equivalentes para ESE plato
  function alternativas(day, meal, comida, idx) {
    const actual = NP.slot.comida(platos(day, meal)[idx], comida.tipo);
    if (!actual) return;
    const alts = NP.data.alternativas(actual, 12);
    const grid = el("div", { class: "grid grid-cards" });
    if (!alts.length) grid.appendChild(el("div", { class: "muted" }, "No hay alternativas equivalentes en este rango. Prueba el buscador."));
    alts.forEach((r) => {
      const card = NP.comp.recipeCard(r, (rec) => NP.comp.recipeDetail(rec));
      card.appendChild(el("button", {
        class: "btn btn-primary btn-sm", style: "margin:0 12px 12px",
        onclick: (e) => {
          e.stopPropagation();
          setPlato(day, meal, idx, { kind: "receta", refId: r.id, alternativas: [] });
          m.close(); toast("Plato cambiado");
        },
      }, "Usar esta"));
      grid.appendChild(card);
    });
    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:12px" },
        `Alternativas a “${actual.nombre}” (${fmt(actual.nutricion.energia_kcal)} kcal) por si ese día no le apetece. Mismo tipo y kcal similares.`),
      grid,
    ]);
    const m = NP.util.modal({ title: "Recetas de cambio", body, wide: true });
  }

  // Ajustar las cantidades (gramos) de un plato, recalculando su nutrición
  function ajustarCantidades(day, meal, idx) {
    const s = platos(day, meal)[idx];
    const base = NP.data.getReceta(s.refId);
    if (!base) return;
    const src = s.custom ? s.custom.ingredientes : base.ingredientes;
    const work = src.map((i) => ({ f_id: i.f_id, nombre: i.nombre, gramos: Number(i.gramos) || 0, casera: i.casera || "", bedca_nombre: i.bedca_nombre || i.nombre }));
    const originales = base.ingredientes.map((i) => Number(i.gramos) || 0);

    const kpi = (v, l) => el("div", { class: "kpi" }, [el("div", { class: "v" }, v), el("div", { class: "l" }, l)]);
    const calc = () => NP.nutri.sumIngredientes(work.map((i) => ({ f_id: i.f_id, g: i.gramos })), NP.data.catalogo);
    const rowsWrap = el("div", {});
    const totalsWrap = el("div", {});

    function renderTotals() {
      const n = calc();
      totalsWrap.innerHTML = "";
      totalsWrap.appendChild(el("div", { class: "kpis" }, [
        kpi(fmt(n.energia_kcal), "kcal"), kpi(fmt(n.proteinas_g, 1) + " g", "Proteínas"),
        kpi(fmt(n.hidratos_g, 1) + " g", "Hidratos"), kpi(fmt(n.grasas_g, 1) + " g", "Grasas"),
      ]));
      totalsWrap.appendChild(NP.comp.macroBar(n));
      // Tabla completa a la vista: calorías, macros, minerales y vitaminas
      totalsWrap.appendChild(el("div", { class: "toolbar", style: "margin:18px 0 4px" }, [
        el("h4", { class: "grow", style: "margin:0" }, "Conteo nutricional"),
        el("span", { class: "small muted" }, `total de ${work.length} ingrediente(s)`),
      ]));
      totalsWrap.appendChild(NP.comp.nutritionTable(n));
    }
    function renderRows() {
      rowsWrap.innerHTML = "";
      work.forEach((i) => {
        const g = el("input", { type: "number", value: i.gramos, min: 0, step: 5 });
        g.addEventListener("input", () => { i.gramos = Number(g.value) || 0; marcarTamano(null); renderTotals(); });
        rowsWrap.appendChild(el("div", { class: "ing-row" }, [
          el("span", { class: "ing-nm" }, i.nombre + (i.casera ? ` · ${i.casera}` : "")),
          g, el("span", { class: "muted small" }, "g"),
        ]));
      });
    }
    const escalar = (f) => { work.forEach((i, k) => (i.gramos = Math.round(originales[k] * f))); renderRows(); renderTotals(); };

    /* Tamaño de ración S/M/XL: los mismos factores que al elegir la receta.
       Siempre se escala desde los gramos originales, así S → XL no acumula.
       Si luego se tocan gramos a mano, deja de haber tamaño marcado. */
    let tamanoSel = s.custom ? (s.tamano || null) : "M";
    const tamBtns = {};
    function marcarTamano(key) {
      tamanoSel = key;
      NP.TAMANOS.forEach((t) => tamBtns[t.key].classList.toggle("btn-primary", t.key === key));
    }
    const tamanoRow = el("div", { class: "row", style: "align-items:center;margin-bottom:10px" }, [
      el("span", { class: "muted small", style: "flex:0 0 auto" }, "Tamaño de ración:"),
      el("div", { class: "size-pick", style: "flex:0 0 auto;padding:0" }, NP.TAMANOS.map((t) => {
        const b = el("button", {
          class: "btn btn-sm" + (t.key === tamanoSel ? " btn-primary" : ""),
          title: `${t.label} · gramos originales × ${t.factor}`,
          onclick: () => { escalar(t.factor); marcarTamano(t.key); },
        }, [
          el("b", {}, t.key),
          el("span", { class: "sz-k" }, Math.round((base.nutricion.energia_kcal || 0) * t.factor) + " kcal"),
        ]);
        tamBtns[t.key] = b;
        return b;
      })),
    ]);

    const escalaRow = el("div", { class: "row", style: "align-items:center;margin-bottom:12px" }, [
      el("span", { class: "muted small", style: "flex:0 0 auto" }, "Escalar todo:"),
      ...[["× 0,5", 0.5], ["× 1", 1], ["× 1,5", 1.5], ["× 2", 2]].map(([l, f]) =>
        el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => { escalar(f); marcarTamano(null); } }, l)),
    ]);

    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:12px" }, "Elige un tamaño de ración (S/M/XL) o cambia los gramos de cada ingrediente. Los macros y micros se recalculan solos y se guardan solo en este día."),
      tamanoRow, escalaRow, rowsWrap,
      el("hr", { style: "border:none;border-top:1px solid var(--line-soft);margin:12px 0" }),
      totalsWrap,
    ]);
    const m = NP.util.modal({
      title: "Ajustar cantidades · " + base.nombre, body, wide: true,
      footer: [
        s.custom ? el("button", {
          class: "btn btn-ghost btn-danger", onclick: () => {
            const limpio = { ...s }; delete limpio.custom; delete limpio.tamano;
            setPlato(day, meal, idx, limpio); m.close(); toast("Cantidades originales restauradas");
          },
        }, "Restablecer original") : null,
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            const item = { ...s };
            // Si queda igual que la receta original, se guarda sin ajuste
            if (work.every((i, k) => i.gramos === originales[k])) {
              delete item.custom; delete item.tamano;
            } else {
              item.custom = {
                nombre: base.nombre,
                ingredientes: work.map((i) => ({ f_id: i.f_id, nombre: i.nombre, gramos: i.gramos, casera: i.casera, bedca_nombre: i.bedca_nombre })),
                nutricion: calc(),
              };
              if (tamanoSel && tamanoSel !== "M") item.tamano = tamanoSel; else delete item.tamano;
            }
            setPlato(day, meal, idx, item);
            m.close(); toast(tamanoSel && tamanoSel !== "M" ? `Ración ${tamanoSel} guardada` : "Cantidades actualizadas");
          },
        }, "Guardar cantidades"),
      ].filter(Boolean),
    });
    renderRows(); renderTotals();
  }

  /* ---------- Copiar a otros días ----------
     Copia profunda siempre (JSON), para que ajustar cantidades en un día
     no toque los demás. */
  const clonar = (x) => JSON.parse(JSON.stringify(x));

  // Selector de días con atajos. Devuelve { wrap, seleccionados() }
  function selectorDias(excluir) {
    const checks = NP.DIAS.filter((d) => d.key !== excluir).map((d) => {
      const input = el("input", { type: "checkbox", checked: true, style: "width:auto;margin:0;flex:0 0 auto" });
      return { key: d.key, input, label: el("label", { class: "dia-check" }, [input, el("span", {}, DIA_LARGO[d.key])]) };
    });
    const marcar = (fn) => checks.forEach((c) => (c.input.checked = fn(c.key)));
    const atajos = el("div", { class: "row", style: "margin-bottom:8px" }, [
      el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => marcar(() => true) }, "Todos"),
      el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => marcar(() => false) }, "Ninguno"),
      el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => marcar((k) => k !== "sabado" && k !== "domingo") }, "Solo entre semana"),
      el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => marcar((k) => k === "sabado" || k === "domingo") }, "Solo fin de semana"),
    ]);
    return {
      wrap: el("div", {}, [atajos, el("div", { class: "dias-pick" }, checks.map((c) => c.label))]),
      seleccionados: () => checks.filter((c) => c.input.checked).map((c) => c.key),
    };
  }

  // Conmutador de dos opciones. opciones = [[valor, etiqueta], [valor, etiqueta]]
  // La primera queda seleccionada por defecto.
  function selectorModo(opciones) {
    let modo = opciones[0][0];
    const seg = el("div", { class: "seg" }, opciones.map(([v, txt], i) =>
      el("button", { class: i === 0 ? "active" : "", onclick: (e) => set(v, e.target) }, txt)));
    function set(v, btn) {
      modo = v;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    return { seg, modo: () => modo };
  }

  // Copia todas las comidas de un día a los días elegidos
  function copiarDia(origen) {
    const resumen = plan.comidas
      .map((c) => { const n = NP.slot.lista(plan.dias[origen][c.key]).length; return n ? `${c.label} (${n})` : null; })
      .filter(Boolean).join(" · ");
    if (!resumen) { toast(`${DIA_LARGO[origen]} está vacío, no hay nada que copiar`); return; }

    const sel = selectorDias(origen);
    const modo = selectorModo([["reemplazar", "Reemplazar el día"], ["añadir", "Añadir a lo que haya"]]);
    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:4px" }, "Se copia:"),
      el("div", { style: "margin-bottom:14px" }, resumen),
      el("div", { class: "small muted", style: "margin-bottom:6px" }, "¿Qué hacemos con esos días?"),
      modo.seg,
      el("div", { class: "small muted", style: "margin:14px 0 6px" }, "Copiar a:"),
      sel.wrap,
    ]);
    const m = NP.util.modal({
      title: `Copiar ${DIA_LARGO[origen]} a otros días`, body,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const dias = sel.seleccionados();
          if (!dias.length) { toast("Elige al menos un día"); return; }
          const reemplazar = modo.modo() === "reemplazar";
          dias.forEach((d) => plan.comidas.forEach((c) => {
            const copia = clonar(NP.slot.lista(plan.dias[origen][c.key]));
            const destino = reemplazar ? copia : NP.slot.lista(plan.dias[d][c.key]).concat(copia);
            plan.dias[d][c.key] = destino.length ? destino : null;
          }));
          save(); rerender(); m.close();
          toast(`${DIA_LARGO[origen]} copiado a ${dias.length} día(s)`);
        } }, "Copiar"),
      ],
    });
  }

  // Copia un solo plato al mismo hueco de otros días
  function copiarPlato(day, meal, idx, comida) {
    const item = platos(day, meal)[idx];
    const r = NP.slot.comida(item, comida.tipo);
    if (!r) return;
    const sel = selectorDias(day);
    const modo = selectorModo([["añadir", "Añadir al hueco"], ["reemplazar", "Reemplazar el hueco"]]);
    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:4px" }, "Se copia este plato:"),
      el("div", { style: "margin-bottom:14px" }, `${r.nombre} · ${fmt(r.nutricion.energia_kcal)} kcal`),
      el("div", { class: "small muted", style: "margin-bottom:6px" }, `Irá a "${comida.label}" de los días que elijas:`),
      modo.seg,
      el("div", { class: "small muted", style: "margin:14px 0 6px" }, "Copiar a:"),
      sel.wrap,
    ]);
    const m = NP.util.modal({
      title: "Copiar plato a otros días", body,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const dias = sel.seleccionados();
          if (!dias.length) { toast("Elige al menos un día"); return; }
          const añadir = modo.modo() === "añadir";
          dias.forEach((d) => {
            const previos = añadir ? NP.slot.lista(plan.dias[d][meal]) : [];
            plan.dias[d][meal] = previos.concat([clonar(item)]);
          });
          save(); rerender(); m.close();
          toast(`"${r.nombre}" copiado a ${dias.length} día(s)`);
        } }, "Copiar"),
      ],
    });
  }

  /* ---------- Arrastrar y soltar ----------
     Arrastrar una tarjeta la COPIA en el hueco donde la sueltes.
     Con Shift pulsado, la mueve. Arrastrar la cabecera de un día copia el día entero. */
  let arrastre = null; // { tipo:"plato", day, meal, idx } | { tipo:"dia", day }

  const limpiarMarcas = () =>
    document.querySelectorAll(".drop-target, .drop-antes, .drop-despues")
      .forEach((n) => n.classList.remove("drop-target", "drop-antes", "drop-despues"));

  function soltarPlato(origen, destino, mover) {
    if (origen.day === destino.day && origen.meal === destino.meal) return; // mismo sitio
    const item = clonar(platos(origen.day, origen.meal)[origen.idx]);
    if (!item) return;
    const r = NP.slot.comida(item, destino.tipo);
    plan.dias[destino.day][destino.meal] = NP.slot.lista(plan.dias[destino.day][destino.meal]).concat([item]);
    if (mover) {
      const l = platos(origen.day, origen.meal).slice();
      l.splice(origen.idx, 1);
      plan.dias[origen.day][origen.meal] = l.length ? l : null;
    }
    save(); rerender();
    toast(`${r ? r.nombre : "Plato"} ${mover ? "movido" : "copiado"} a ${DIA_LARGO[destino.day]}`);
  }

  // Reordenar platos dentro del MISMO hueco: saca el plato de su sitio y lo inserta
  // en la posición donde se ha soltado (con dos platos equivale a intercambiarlos).
  function reordenarPlato(day, meal, from, hasta) {
    const l = platos(day, meal).slice();
    if (from < 0 || from >= l.length) return;
    let destino = hasta;
    if (from < destino) destino--; // al quitar el de origen, los de detrás suben uno
    if (destino === from) return;
    const [item] = l.splice(from, 1);
    l.splice(destino, 0, item);
    setPlatos(day, meal, l);
    toast("Platos reordenados");
  }

  // La tarjeta acepta que le suelten encima otro plato del mismo hueco: se coloca
  // antes o después según se suelte en su mitad de arriba o de abajo.
  function zonaReordenar(card, day, meal, idx) {
    const mismoHueco = () => arrastre && arrastre.tipo === "plato" && arrastre.day === day && arrastre.meal === meal;
    const marca = (e) => {
      const r = card.getBoundingClientRect();
      const antes = e.clientY < r.top + r.height / 2;
      card.classList.toggle("drop-antes", antes);
      card.classList.toggle("drop-despues", !antes);
      return antes;
    };
    const limpiar = () => card.classList.remove("drop-antes", "drop-despues");
    card.addEventListener("dragover", (e) => {
      if (!mismoHueco() || arrastre.idx === idx) return;
      e.preventDefault();
      e.stopPropagation(); // que el hueco no se marque como destino de copia
      e.dataTransfer.dropEffect = "move";
      marca(e);
    });
    card.addEventListener("dragleave", limpiar);
    card.addEventListener("drop", (e) => {
      if (!mismoHueco() || arrastre.idx === idx) return;
      e.preventDefault();
      e.stopPropagation();
      const antes = marca(e);
      limpiar();
      const origen = arrastre.idx;
      arrastre = null;
      reordenarPlato(day, meal, origen, antes ? idx : idx + 1);
    });
  }

  function soltarDia(origen, destinoDay) {
    if (origen === destinoDay) return;
    plan.comidas.forEach((c) => {
      const copia = clonar(NP.slot.lista(plan.dias[origen][c.key]));
      plan.dias[destinoDay][c.key] = copia.length ? copia : null;
    });
    save(); rerender();
    toast(`${DIA_LARGO[origen]} copiado a ${DIA_LARGO[destinoDay]}`);
  }

  // Convierte un hueco en destino válido para soltar platos
  function zonaSoltar(nodo, day, meal, tipo) {
    nodo.addEventListener("dragover", (e) => {
      if (!arrastre || arrastre.tipo !== "plato") return;
      if (arrastre.day === day && arrastre.meal === meal) return; // dentro del hueco se reordena, no se copia
      e.preventDefault();
      e.dataTransfer.dropEffect = e.shiftKey ? "move" : "copy";
      nodo.classList.add("drop-target");
    });
    nodo.addEventListener("dragleave", () => nodo.classList.remove("drop-target"));
    nodo.addEventListener("drop", (e) => {
      nodo.classList.remove("drop-target");
      if (!arrastre || arrastre.tipo !== "plato") return;
      e.preventDefault();
      soltarPlato(arrastre, { day, meal, tipo }, e.shiftKey);
      arrastre = null;
    });
  }

  function slotEl(day, meal, comida) {
    // Solo los platos que resuelven: si una receta ya no está en el catálogo, el hueco se ve
    // vacío en vez de dejar un pie huérfano. Se conserva el índice real para editar y borrar.
    const lista = platos(day, meal)
      .map((item, idx) => ({ item, idx, r: NP.slot.comida(item, comida.tipo) }))
      .filter((x) => x.r);
    if (!lista.length) {
      const vacio = el("div", { class: "slot" }, [
        el("div", { class: "slot-empty", onclick: () => elegirPlato(day, meal, comida, null), title: "Añadir plato (o suelta aquí uno arrastrado)" }, "＋"),
      ]);
      zonaSoltar(vacio, day, meal, comida.tipo);
      return vacio;
    }
    const dishes = el("div", { class: "slot-dishes" });
    lista.forEach(({ item, idx, r }) => {
      const card = el("div", {
        class: "slot-card", draggable: "true",
        title: "Arrástralo sobre otro plato de esta misma comida para cambiarlo de orden, o a otro hueco para copiarlo (Shift = moverlo)",
      }, [
        el("div", { class: "st", title: r.nombre, onclick: () => NP.comp.recipeDetail(r), style: "cursor:pointer" }, r.nombre),
        el("div", { class: "sk" }, `${fmt(r.nutricion.energia_kcal)} kcal` + (r._alimentos ? " · 🥗" : (r._ajustada ? " · ⚖️" : ""))),
        el("div", { class: "slot-actions" }, [
          el("button", { class: "btn btn-sm", title: "Ajustar cantidades", onclick: () => (item.kind === "alimentos" ? editarAlimentos(day, meal, idx) : ajustarCantidades(day, meal, idx)) }, "⚖️"),
          el("button", { class: "btn btn-sm", title: "Recetas de cambio", onclick: () => alternativas(day, meal, comida, idx) }, "🔁"),
          el("button", { class: "btn btn-sm", title: "Cambiar este plato", onclick: () => elegirPlato(day, meal, comida, idx) }, "✎"),
          el("button", { class: "btn btn-sm btn-danger", title: "Quitar este plato", onclick: () => quitarPlato(day, meal, idx) }, "🗑"),
        ]),
      ]);
      card.addEventListener("dragstart", (e) => {
        arrastre = { tipo: "plato", day, meal, idx };
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", r.nombre); // Firefox no arrastra sin datos
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => { card.classList.remove("dragging"); arrastre = null; limpiarMarcas(); });
      zonaReordenar(card, day, meal, idx);
      dishes.appendChild(card);
    });
    // Pie del hueco: total (solo con más de un plato) y botón para añadir otro
    dishes.appendChild(el("div", { class: "slot-foot" }, [
      el("span", { class: "slot-sum" }, lista.length > 1
        ? `${lista.length} platos · ${fmt(NP.slot.kcal(plan.dias[day][meal], comida.tipo))} kcal` : ""),
      el("button", {
        class: "btn btn-sm slot-add", title: "Añadir otro plato a esta comida",
        onclick: () => elegirPlato(day, meal, comida, null),
      }, "＋ plato"),
    ]));
    const slotDiv = el("div", { class: "slot" }, [dishes]);
    zonaSoltar(slotDiv, day, meal, comida.tipo);
    return slotDiv;
  }

  const dayKcal = (day) => plan.comidas.reduce((s, c) => s + NP.slot.kcal(plan.dias[day][c.key], c.tipo), 0);

  const gridWrap = el("div", { class: "plan-scroll" });
  function buildGrid() {
    const g = el("div", { class: "plan-grid" });
    g.appendChild(el("div", { class: "ph" }, "")); // esquina
    NP.DIAS.forEach((d) => {
      const cab = el("div", { class: "ph" }, [
        el("div", { class: "ph-day", draggable: "true", title: `Arrastra ${DIA_LARGO[d.key]} sobre otro día para copiarlo entero` }, [
          el("span", { style: "flex:1" }, d.label),
          el("button", {
            class: "icon-btn", style: "width:24px;height:24px;font-size:13px",
            title: `Copiar ${DIA_LARGO[d.key]} a varios días a la vez`,
            onclick: () => copiarDia(d.key),
          }, "📋"),
        ]),
      ]);
      const asa = cab.firstChild;
      asa.addEventListener("dragstart", (e) => {
        arrastre = { tipo: "dia", day: d.key };
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", DIA_LARGO[d.key]);
        cab.classList.add("dragging");
      });
      asa.addEventListener("dragend", () => { cab.classList.remove("dragging"); arrastre = null; limpiarMarcas(); });
      // Soltar un día sobre otro día
      cab.addEventListener("dragover", (e) => {
        if (!arrastre || arrastre.tipo !== "dia" || arrastre.day === d.key) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "copy";
        cab.classList.add("drop-target");
      });
      cab.addEventListener("dragleave", () => cab.classList.remove("drop-target"));
      cab.addEventListener("drop", (e) => {
        cab.classList.remove("drop-target");
        if (!arrastre || arrastre.tipo !== "dia") return;
        e.preventDefault();
        soltarDia(arrastre.day, d.key);
        arrastre = null;
      });
      g.appendChild(cab);
    });
    plan.comidas.forEach((c) => {
      g.appendChild(el("div", { class: "rowlabel" }, [
        el("span", { style: "flex:1" }, c.label),
        el("button", { class: "icon-btn", style: "width:22px;height:22px;font-size:12px", title: "Quitar esta comida del plan", onclick: () => deleteComida(c) }, "✕"),
      ]));
      NP.DIAS.forEach((d) => g.appendChild(slotEl(d.key, c.key, c)));
    });
    // fila de totales
    g.appendChild(el("div", { class: "rowlabel" }, "Total/día"));
    NP.DIAS.forEach((d) => {
      const k = dayKcal(d.key);
      const obj = pac ? pac.kcal_objetivo : null;
      const ok = obj ? Math.abs(k - obj) <= obj * 0.12 : true;
      g.appendChild(el("div", { class: "day-total" }, [
        el("b", { style: obj && k ? (ok ? "" : "color:var(--danger)") : "" }, fmt(k)),
        el("span", { class: "muted" }, " kcal"),
      ]));
    });
    gridWrap.innerHTML = ""; gridWrap.appendChild(g);
  }

  // Estira la rejilla hasta el borde inferior de la ventana para que las filas se repartan
  // el alto libre (.plan-grid{height:100%}). Si los platos ocupan más, manda el contenido.
  function ajustarAlto() {
    gridWrap.style.height = "auto";
    const libre = Math.round(window.innerHeight - gridWrap.getBoundingClientRect().top - 24);
    if (libre > gridWrap.scrollHeight) gridWrap.style.height = libre + "px";
  }
  window.addEventListener("resize", () => { if (gridWrap.isConnected) ajustarAlto(); });

  // ---- Panel lateral: conteo nutricional del día o de la semana ----
  const sideWrap = el("div", { class: "plan-side" });
  const layout = el("div", { class: "plan-layout" }, [gridWrap, sideWrap]);
  // Ocultar el panel da ~316 px más a la rejilla (útil en pantallas de portátil)
  const btnPanel = el("button", { class: "btn", onclick: () => {
    const oculto = layout.classList.toggle("sin-panel");
    btnPanel.textContent = oculto ? "📊 Ver nutrientes" : "📊 Ocultar nutrientes";
  } }, "📊 Ocultar nutrientes");
  // modo: "dia" (un día concreto) | "semana"; semana: "media" (media diaria) | "total" (los 7 días)
  let sel = { modo: "dia", dia: "lunes", semana: "media" };

  // Nutrición sumada de todas las comidas de un día (cada hueco puede llevar varios platos)
  const nutDia = (day) => NP.nutri.sumNutriciones(
    plan.comidas.map((c) => NP.slot.nutricion(plan.dias[day][c.key], c.tipo)));
  const nutSemana = () => NP.nutri.sumNutriciones(NP.DIAS.map((d) => nutDia(d.key)));
  // Ingredientes de todos los platos del día, para medir qué nutrientes trae realmente la tabla BEDCA
  const cobDia = (day) => NP.nutri.cobertura(
    plan.comidas.reduce((acc, c) => acc.concat(
      NP.slot.comidas(plan.dias[day][c.key], c.tipo).reduce((a, m) => a.concat(
        (m.ingredientes || []).map((i) => ({ f_id: i.f_id, g: i.gramos }))), [])), []),
    NP.data.catalogo);
  // Multiplica todos los nutrientes por un factor (para la media diaria)
  const escalar = (n, f) => {
    const o = {}; NP.nutri.CLAVES.forEach((k) => (o[k] = Math.round((n[k] || 0) * f * 10) / 10)); return o;
  };
  // Se cuentan los platos que resuelven, para que cuadre con lo que se ve en la rejilla
  const platosOk = (day, meal) => NP.slot.comidas(plan.dias[day][meal], tipoDeComida(meal)).length;
  const comidasAsignadas = (day) => plan.comidas.filter((c) => platosOk(day, c.key)).length;
  const platosDia = (day) => plan.comidas.reduce((s, c) => s + platosOk(day, c.key), 0);

  function buildSide() {
    sideWrap.innerHTML = "";

    // Pestañas: los 7 días + la semana completa
    const tabs = el("div", { class: "day-tabs" });
    NP.DIAS.forEach((d) => tabs.appendChild(el("button", {
      class: "btn btn-sm" + (sel.modo === "dia" && sel.dia === d.key ? " on" : ""),
      onclick: () => { sel.modo = "dia"; sel.dia = d.key; buildSide(); },
    }, d.label)));
    tabs.appendChild(el("button", {
      class: "btn btn-sm" + (sel.modo === "semana" ? " on" : ""),
      onclick: () => { sel.modo = "semana"; buildSide(); },
    }, "Semana"));
    sideWrap.appendChild(tabs);

    // Datos según el modo
    let n, titulo, sub, objRef;
    const obj = pac ? pac.kcal_objetivo : null;
    if (sel.modo === "dia") {
      n = nutDia(sel.dia);
      titulo = DIA_LARGO[sel.dia] || sel.dia;
      sub = `${comidasAsignadas(sel.dia)} de ${plan.comidas.length} comidas · ${platosDia(sel.dia)} plato(s)`;
      objRef = obj;
    } else {
      const total = nutSemana();
      const media = sel.semana === "media";
      n = media ? escalar(total, 1 / 7) : total;
      titulo = media ? "Semana · media por día" : "Semana · total 7 días";
      const asignadas = NP.DIAS.reduce((s, d) => s + comidasAsignadas(d.key), 0);
      const nPlatos = NP.DIAS.reduce((s, d) => s + platosDia(d.key), 0);
      sub = `${asignadas} de ${plan.comidas.length * 7} comidas · ${nPlatos} plato(s)`;
      objRef = obj ? (media ? obj : obj * 7) : null;
    }

    sideWrap.appendChild(el("div", { class: "side-ttl" }, titulo));
    sideWrap.appendChild(el("div", { class: "small muted", style: "margin-bottom:10px" }, sub));

    // En modo semana, conmutador media/total
    if (sel.modo === "semana") {
      sideWrap.appendChild(el("div", { class: "day-tabs" }, [
        el("button", { class: "btn btn-sm" + (sel.semana === "media" ? " on" : ""), onclick: () => { sel.semana = "media"; buildSide(); } }, "Media/día"),
        el("button", { class: "btn btn-sm" + (sel.semana === "total" ? " on" : ""), onclick: () => { sel.semana = "total"; buildSide(); } }, "Total 7 días"),
      ]));
    }

    // Desvío respecto al objetivo del paciente (±12 % se considera en rango)
    if (objRef && n.energia_kcal) {
      const dif = Math.round(n.energia_kcal - objRef);
      const ok = Math.abs(dif) <= objRef * 0.12;
      sideWrap.appendChild(el("div", {
        class: "pill" + (ok ? " accent" : ""),
        style: "margin-bottom:10px;display:inline-block" + (ok ? "" : ";color:var(--danger);border-color:var(--danger)"),
      }, `${dif >= 0 ? "+" : "−"}${fmt(Math.abs(dif))} kcal sobre el objetivo (${fmt(objRef)})`));
    }

    sideWrap.appendChild(el("div", { class: "kpis" }, [
      kpiSide(fmt(n.energia_kcal), "kcal"), kpiSide(fmt(n.proteinas_g, 1) + " g", "Proteínas"),
      kpiSide(fmt(n.hidratos_g, 1) + " g", "Hidratos"), kpiSide(fmt(n.grasas_g, 1) + " g", "Grasas"),
    ]));
    sideWrap.appendChild(NP.comp.macroBar(n));

    // Referencias oficiales EFSA para este paciente. En "total 7 días" se multiplican por 7.
    const perf = NP.dri.perfil(pac);
    const factor = sel.modo === "semana" && sel.semana === "total" ? 7 : 1;
    const refs = NP.dri.referencias(perf, factor);
    // Cobertura de la tabla de composición: evita marcar en rojo lo que BEDCA no mide
    const cobs = NP.nutri.pctCobertura(sel.modo === "dia"
      ? cobDia(sel.dia)
      : NP.nutri.sumCoberturas(NP.DIAS.map((d) => cobDia(d.key))));
    const res = NP.dri.resumen(n, refs, cobs);

    sideWrap.appendChild(el("div", { class: "side-ttl", style: "margin-top:16px" }, "Conteo nutricional"));
    sideWrap.appendChild(el("div", { class: "dri-perfil" }, [
      el("span", { class: "grow small" }, [
        el("b", {}, "Objetivos: "), NP.dri.describir(perf),
        factor > 1 ? el("span", { class: "muted" }, " · ×7 días") : null,
      ]),
      el("button", {
        class: "icon-btn", title: "Ajustar el perfil de referencia (embarazo, lactancia, fitatos...)",
        style: "width:26px;height:26px;font-size:13px", onclick: editarPerfilDri,
      }, "⚙"),
    ]));
    if (perf.sinPaciente || !perf.edadReal) sideWrap.appendChild(el("div", { class: "small muted", style: "margin-bottom:8px" },
      perf.sinPaciente
        ? "Este plan no tiene paciente: se usan referencias de adulto de 30 años."
        : "Sin fecha de nacimiento: se asume 30 años. Ajusta la edad con ⚙ o rellena la ficha."));
    if (perf.sexo === "indeterminado") sideWrap.appendChild(el("div", { class: "small muted", style: "margin-bottom:8px" },
      "Sexo sin indicar: se toma en cada nutriente el valor más exigente de los dos."));

    sideWrap.appendChild(el("div", {
      class: "dri-resumen " + (res.bajos.length ? "hay-fallos" : "todo-ok"),
    }, [
      el("b", {}, `${res.ok} de ${res.total} objetivos cubiertos`),
      res.bajos.length ? el("div", { class: "small", style: "margin-top:4px" },
        "Falta: " + res.bajos.join(", ")) : null,
      res.altos.length ? el("div", { class: "small", style: "margin-top:4px" },
        "Se pasa de: " + res.altos.join(", ")) : null,
      res.sinDatos.length ? el("div", { class: "small", style: "margin-top:4px" },
        "Sin datos en la tabla de alimentos: " + res.sinDatos.join(", ")) : null,
    ]));
    sideWrap.appendChild(NP.comp.nutritionTable(n, [], refs, cobs));
  }

  // Ajustes del perfil de referencia. Se guardan en el paciente (p.dri) para todos sus planes.
  function editarPerfilDri() {
    const perf = NP.dri.perfil(pac);
    const fEdad = el("input", { type: "number", min: 1, max: 110, value: perf.edad });
    const fEstado = el("select", {}, [
      ["normal", "Ninguno"], ["embarazo", "Embarazo"], ["lactancia", "Lactancia"],
    ].map(([v, l]) => el("option", { value: v, ...(v === perf.estado ? { selected: true } : {}) }, l)));
    const fMeno = el("select", {}, [
      ["no", "Premenopáusica (hierro 16 mg/día)"], ["si", "Posmenopáusica (hierro 11 mg/día)"],
    ].map(([v, l]) => el("option", { value: v, ...((v === "si") === perf.menopausia ? { selected: true } : {}) }, l)));
    const fFit = el("select", {}, [
      [300, "300 mg · dieta baja en cereales integrales y legumbres"],
      [600, "600 mg · dieta mixta europea habitual"],
      [900, "900 mg · muchos integrales y legumbres"],
      [1200, "1.200 mg · vegetariana/vegana rica en integrales"],
    ].map(([v, l]) => el("option", { value: String(v), ...(v === perf.fitatos ? { selected: true } : {}) }, l)));

    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:12px;line-height:1.5" },
        "Las necesidades de vitaminas y minerales cambian con la edad, el sexo y la situación " +
        "fisiológica. Estos ajustes se guardan en la ficha del paciente."),
      el("label", { class: "field" }, [el("span", {}, "Edad para las referencias (años)"), fEdad]),
      el("label", { class: "field" }, [el("span", {}, "Situación fisiológica"), fEstado]),
      perf.sexo === "hombre" ? null
        : el("label", { class: "field" }, [el("span", {}, "Estado menstrual (afecta al hierro)"), fMeno]),
      el("label", { class: "field" }, [el("span", {}, "Fitatos de la dieta (afecta al zinc)"), fFit]),
    ]);
    const m = NP.util.modal({
      title: "Perfil de referencia (EFSA)", body,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            if (!pac) { toast("Este plan no tiene paciente donde guardar el perfil"); return; }
            pac.dri = {
              edad: Number(fEdad.value) || null,
              estado: fEstado.value,
              menopausia: fMeno.value === "si",
              fitatos: Number(fFit.value),
            };
            NP.store.savePaciente(pac);
            m.close(); buildSide(); toast("Referencias actualizadas");
          },
        }, "Aplicar"),
      ],
    });
  }
  const kpiSide = (v, l) => el("div", { class: "kpi" }, [el("div", { class: "v" }, v), el("div", { class: "l" }, l)]);

  function rerender() { buildGrid(); buildSide(); ajustarAlto(); }

  // Añadir una comida (fila) al plan, en todos los días
  function addComida() {
    const nombreInp = el("input", { placeholder: "Ej. Media mañana, Recena, Postre..." });
    const tipoSel = el("select", {}, [
      ["merienda", "Merienda / snack (fruta, yogur, frutos secos...)"],
      ["comida_cena", "Comida / Cena (platos principales)"],
      ["desayuno", "Desayuno (tostadas, bowls, batidos...)"],
    ].map(([v, l]) => el("option", { value: v }, l)));
    const posSel = el("select", {}, [el("option", { value: "-1" }, "Al final")].concat(
      plan.comidas.map((c, i) => el("option", { value: String(i) }, "Después de " + c.label))));
    const presets = el("div", { class: "row", style: "margin-bottom:4px" },
      [["Media mañana", "merienda"], ["Recena", "comida_cena"], ["Postre", "merienda"]].map(([nm, tp]) =>
        el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => { nombreInp.value = nm; tipoSel.value = tp; } }, nm)));
    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:10px" }, "Se añade a los 7 días del plan."),
      el("div", { class: "muted small", style: "margin-bottom:6px" }, "Atajos:"), presets,
      el("label", { class: "field", style: "margin-top:12px" }, [el("span", {}, "Nombre de la comida"), nombreInp]),
      el("label", { class: "field" }, [el("span", {}, "Tipo (define qué recetas se ofrecen)"), tipoSel]),
      el("label", { class: "field" }, [el("span", {}, "Posición en el día"), posSel]),
    ]);
    const m = NP.util.modal({
      title: "Añadir comida al día", body,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            const label = nombreInp.value.trim();
            if (!label) { toast("Ponle un nombre"); return; }
            const key = "m_" + NP.util.uid().slice(0, 6);
            const nueva = { key, label, tipo: tipoSel.value };
            const pos = Number(posSel.value);
            if (pos < 0) plan.comidas.push(nueva); else plan.comidas.splice(pos + 1, 0, nueva);
            NP.DIAS.forEach((d) => (plan.dias[d.key][key] = null));
            save(); m.close(); rerender(); toast("Comida añadida");
          },
        }, "Añadir"),
      ],
    });
  }
  function deleteComida(c) {
    if (plan.comidas.length <= 1) { toast("Debe quedar al menos una comida"); return; }
    if (!confirm(`¿Quitar "${c.label}" de todos los días del plan? Se perderá lo asignado en esa fila.`)) return;
    plan.comidas = plan.comidas.filter((x) => x.key !== c.key);
    NP.DIAS.forEach((d) => delete plan.dias[d.key][c.key]);
    save(); rerender(); toast("Comida quitada");
  }

  // cabecera
  const objTxt = pac ? `Objetivo: ${fmt(pac.kcal_objetivo)} kcal/día` : "";
  view.appendChild(el("div", { class: "plan-head" }, [
    el("button", { class: "btn btn-ghost", onclick: () => NP.app.go(pac ? "#/paciente/" + pac.id : "#/pacientes") }, "← Volver"),
    el("div", { class: "grow" }),
    el("span", { class: "pill accent" }, objTxt),
    btnPanel,
    el("button", { class: "btn", onclick: addComida }, "＋ Añadir comida"),
    el("button", { class: "btn", onclick: () => {
      if (!pac) { toast("Este plan no tiene paciente"); return; }
      // El PDF sale firmado con el nombre del nutricionista que ha entrado
      const yo = NP.auth.actual();
      NP.pdf.exportarPlan(plan, pac, yo && yo.rol === "nutri" ? { nutri: { nombre: yo.nombre } } : undefined);
      toast("Se abre el PDF: elige «Guardar como PDF»");
    } }, "⬇ Ver/Imprimir PDF"),
    el("button", { class: "btn btn-primary", onclick: () => {
      if (!pac) { toast("Este plan no tiene paciente"); return; }
      NP.pdf.flujoEnviarAlMovil(plan, pac);
    } }, "📲 Enviar PDF al paciente"),
  ]));
  view.appendChild(el("div", { class: "small muted", style: "margin-bottom:12px" },
    "Esta semana se repite durante el mes. Cada comida admite varios platos: pulsa «＋ plato» para " +
    "añadir, por ejemplo, una ensalada al arroz con pollo. Con 🔁 ves recetas de cambio."));
  view.appendChild(layout);
  buildGrid(); buildSide(); ajustarAlto();
};
