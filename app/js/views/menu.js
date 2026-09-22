/* views/menu.js — menú por opciones (el otro formato de plan).
   En vez de una rejilla de 7 días, el plan se organiza en BLOQUES de días
   («días de entrenamiento», «días de descanso»...), y dentro de cada bloque
   cada comida ofrece VARIAS OPCIONES entre las que el paciente elige cada día.
   Es la forma de trabajar de muchos nutricionistas y la que el paciente ve
   en «Mi menú» y se lleva en PDF. */
NP.views = NP.views || {};

/** ¿Este plan es un menú por opciones? (los de antes son la rejilla semanal) */
NP.esMenu = (pl) => !!pl && pl.tipo === "opciones";

/* Comidas y bloques que se ofrecen al crearlos, para no escribirlos a mano */
NP.COMIDAS_MENU = ["Al levantarse", "Desayuno", "Media mañana", "Antes de entrenar", "Comida",
  "Post-entreno", "Merienda", "Cena", "Antes de dormir"];
NP.BLOQUES_MENU = ["Días de entrenamiento", "Días de descanso", "Todos los días", "Fin de semana"];

/** Menú vacío con la estructura mínima para empezar a rellenar */
NP.nuevoMenu = function (pacienteId, nombre) {
  const comida = (nom) => ({ id: NP.util.uid(), nombre: nom, texto: "", opciones: [nuevaOpcion()] });
  const bloque = (nom) => ({ id: NP.util.uid(), nombre: nom, nota: "", comidas: ["Desayuno", "Comida", "Cena"].map(comida) });
  return {
    pacienteId, nombre, tipo: "opciones",
    bloques: [bloque("Días de entrenamiento"), bloque("Días de descanso")],
    suplementos: [], nota: "",
  };
};
function nuevaOpcion() {
  return { id: NP.util.uid(), titulo: "", alimentos: [], preparacion: "" };
}

/** Resumen en texto del menú (para mandarlo por WhatsApp o email) */
NP.menuATexto = function (plan, pac) {
  const L = [`*${plan.nombre}*${pac ? " · " + pac.nombre : ""}`, ""];
  (plan.bloques || []).forEach((b) => {
    L.push(`*${b.nombre.toUpperCase()}*`);
    if (b.nota) L.push(b.nota);
    (b.comidas || []).forEach((c) => {
      L.push(`_${c.nombre}_`);
      if (c.texto) L.push("  " + c.texto);
      (c.opciones || []).forEach((o, i) => {
        L.push(`  Opción ${i + 1}${o.titulo ? " — " + o.titulo : ""}`);
        (o.alimentos || []).forEach((a) => L.push("    • " + a));
      });
    });
    L.push("");
  });
  if ((plan.suplementos || []).length) {
    L.push("*SUPLEMENTACIÓN*");
    plan.suplementos.forEach((s) => {
      L.push(`_${s.nombre}_`);
      (s.lineas || []).forEach((x) => L.push("  • " + x));
    });
    L.push("");
  }
  if (plan.nota) L.push(plan.nota);
  return L.join("\n").trim();
};

NP.views.menu = (function () {
  const { el, modal, toast } = NP.util;

  const lineas = (txt) => String(txt || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const nOpciones = (pl) => (pl.bloques || []).reduce((s, b) =>
    s + (b.comidas || []).reduce((x, c) => x + (c.opciones || []).length, 0), 0);
  const nComidas = (pl) => (pl.bloques || []).reduce((s, b) => s + (b.comidas || []).length, 0);
  /** Resumen para la lista de planes de la ficha del paciente */
  const resumen = (pl) => `${(pl.bloques || []).length} bloque(s) · ${nComidas(pl)} comidas · ${nOpciones(pl)} opciones`;

  /* ================= Vista de lectura (paciente y vista previa) ================= */
  function vista(cont, plan, opts) {
    const o = opts || {};
    const bloques = (plan.bloques || []).filter((b) => (b.comidas || []).length);
    if (!bloques.length) {
      cont.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🍽️"),
        el("div", {}, "Este menú todavía está vacío."),
      ]));
      return;
    }

    let actual = bloques[0];
    const seg = bloques.length > 1 ? el("div", { class: "seg seg-docs" }, bloques.map((b, i) =>
      el("button", { class: i === 0 ? "active" : "", onclick: (e) => {
        actual = b;
        Array.from(seg.children).forEach((x) => x.classList.remove("active"));
        e.currentTarget.classList.add("active");
        pintar();
      } }, b.nombre))) : null;

    if (seg) cont.appendChild(el("div", { class: "toolbar" }, [seg]));
    if (plan.nota) cont.appendChild(el("div", { class: "nota-pdf" }, [el("b", {}, "📝 "), plan.nota]));
    const cuerpo = el("div", {});
    cont.appendChild(cuerpo);

    function pintar() {
      cuerpo.innerHTML = "";
      if (!seg) cuerpo.appendChild(el("div", { class: "side-ttl" }, actual.nombre));
      if (actual.nota) cuerpo.appendChild(el("div", { class: "small muted", style: "margin-bottom:10px" }, actual.nota));

      (actual.comidas || []).forEach((c) => {
        const ops = (c.opciones || []).filter((x) => (x.alimentos || []).length || x.titulo);
        // El paciente puede marcar la comida como hecha hoy (o.tick da el botón)
        const tick = o.tick ? o.tick(c) : null;
        cuerpo.appendChild(el("div", { class: "panel comida-bloque" + (tick && tick.classList.contains("hecha") ? " comida-hecha" : ""),
          style: "margin-bottom:12px" }, [
          el("div", { class: "comida-cab" }, [
            el("span", { class: "comida-ic" }, "🍽️"),
            el("span", { class: "comida-lb" }, c.nombre),
            el("span", { class: "grow" }),
            ops.length > 1 ? el("span", { class: "pill accent" }, ops.length + " opciones") : null,
            tick,
          ]),
          c.texto ? el("div", { class: "menu-texto" }, c.texto) : null,
          ops.length ? el("div", { class: "op-grid" }, ops.map((op, i) => tarjetaOpcion(op, i))) : null,
          !ops.length && !c.texto ? el("div", { class: "small muted" }, "Sin opciones todavía.") : null,
        ]));
      });

      if ((plan.suplementos || []).length) {
        cuerpo.appendChild(el("div", { class: "doc-sec" }, [
          el("span", { class: "doc-sec-ic" }, "💊"), el("span", {}, "Suplementación"),
        ]));
        cuerpo.appendChild(el("div", { class: "op-grid" }, plan.suplementos.map((s) =>
          el("div", { class: "op-card" }, [
            el("div", { class: "op-tit" }, s.nombre),
            el("ul", { class: "op-lista" }, (s.lineas || []).map((x) => el("li", {}, x))),
          ]))));
      }
      if (o.pie) cuerpo.appendChild(o.pie);
    }

    function tarjetaOpcion(op, i) {
      return el("div", { class: "op-card" }, [
        el("div", { class: "op-num" }, "Opción " + (i + 1)),
        el("div", { class: "op-tit" }, op.titulo || "—"),
        el("ul", { class: "op-lista" }, (op.alimentos || []).map((a) => el("li", {}, a))),
        op.preparacion ? el("div", { class: "op-prep" }, [el("b", {}, "Preparación: "), op.preparacion]) : null,
      ]);
    }

    pintar();
  }

  /* ================= Editor (nutricionista) ================= */
  function editor(view, planId) {
    const plan = NP.store.getPlan(planId);
    if (!plan || !NP.esMenu(plan)) { NP.app.go("#/pacientes"); return; }
    const pac = NP.store.getPaciente(plan.pacienteId);
    NP.app.setTitle(plan.nombre + (pac ? " · " + pac.nombre : ""));
    const guardar = () => NP.store.savePlan(plan);
    plan.bloques = plan.bloques || [];
    plan.suplementos = plan.suplementos || [];

    let modo = "editar";
    const seg = el("div", { class: "seg", style: "flex:0 0 auto" }, [
      el("button", { class: "active", onclick: (e) => setModo("editar", e.currentTarget) }, "✏️ Editar"),
      el("button", { onclick: (e) => setModo("vista", e.currentTarget) }, "👁 Como lo ve el paciente"),
    ]);
    function setModo(k, btn) {
      modo = k;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pintar();
    }

    view.appendChild(el("div", { class: "plan-head" }, [
      pac ? el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + pac.id) }, "← " + pac.nombre.split(" ")[0]) : null,
      el("div", { class: "grow" }),
      seg,
      el("button", { class: "btn", style: "flex:0 0 auto", onclick: () => {
        guardar(); NP.pdf.exportarPlan(plan, pac || { nombre: "" });
      } }, "📄 PDF"),
      el("button", { class: "btn btn-primary", style: "flex:0 0 auto", onclick: () => { guardar(); toast("Menú guardado ✓"); } }, "Guardar"),
    ].filter(Boolean)));

    const cuerpo = el("div", {});
    view.appendChild(cuerpo);

    /** Campo que guarda solo al salir, para no repintar mientras se escribe */
    function campo(attrs, onSet, multi) {
      const n = el(multi ? "textarea" : "input", attrs, multi ? [attrs.value || ""] : []);
      if (multi) n.removeAttribute("value");
      n.addEventListener("change", () => { onSet(n.value); guardar(); });
      return n;
    }

    function pintar() {
      cuerpo.innerHTML = "";
      if (modo === "vista") {
        vista(cuerpo, plan);
        return;
      }
      const nBloques = plan.bloques.length;
      cuerpo.appendChild(el("div", { class: "panel menu-hero" }, [
        el("div", { class: "menu-hero-cab" }, [
          el("span", { class: "menu-hero-ico" }, "🥗"),
          el("div", { class: "grow" }, [
            el("label", { class: "field", style: "margin-bottom:6px" }, [el("span", {}, "Nombre del menú"),
              campo({ value: plan.nombre, class: "menu-hero-nombre" }, (v) => { plan.nombre = v.trim() || "Menú"; NP.app.setTitle(plan.nombre); })]),
            el("div", { class: "menu-hero-pills" }, [
              pac ? el("span", { class: "pill accent" }, "👤 " + pac.nombre) : null,
              el("span", { class: "pill" }, "📅 " + nBloques + (nBloques === 1 ? " bloque" : " bloques")),
              el("span", { class: "pill" }, "🍽️ " + nComidas(plan) + " comidas"),
              el("span", { class: "pill" }, "✨ " + nOpciones(plan) + " opciones"),
            ]),
          ]),
        ]),
        el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Nota para el paciente (sale arriba del todo)"),
          campo({ rows: 2, value: plan.nota || "", placeholder: "Cómo usar el menú, agua al día, recordatorios..." },
            (v) => { plan.nota = v.trim(); }, true)]),
      ]));

      plan.bloques.forEach((b, iB) => cuerpo.appendChild(panelBloque(b, iB)));
      cuerpo.appendChild(el("div", { class: "row", style: "gap:8px;margin-top:14px" }, [
        el("button", { class: "btn", style: "flex:0 0 auto", onclick: () => elegirNombre("Nuevo bloque de días", NP.BLOQUES_MENU, (nom) => {
          plan.bloques.push({ id: NP.util.uid(), nombre: nom, nota: "", comidas: [] });
          guardar(); pintar();
        }) }, "＋ Añadir bloque de días"),
      ]));
      cuerpo.appendChild(panelSuplementos());
    }

    function panelBloque(b, iB) {
      const comidas = el("div", { class: "menu-comidas" });
      (b.comidas || []).forEach((c, iC) => comidas.appendChild(panelComida(b, c, iC)));

      return el("div", { class: "panel", style: "margin-top:14px" }, [
        el("div", { class: "row", style: "align-items:flex-end;gap:10px" }, [
          el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Bloque de días"),
            campo({ value: b.nombre, class: "dia-nombre" }, (v) => { b.nombre = v.trim() || "Bloque"; })]),
          el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Nota del bloque"),
            campo({ value: b.nota || "", placeholder: "Opcional" }, (v) => { b.nota = v.trim(); })]),
          el("div", { class: "ej-acc" }, [
            mover(plan.bloques, iB, -1), mover(plan.bloques, iB, 1),
            el("button", { class: "icon-btn", title: "Quitar el bloque", onclick: () => {
              if (!confirm("¿Quitar «" + b.nombre + "» y todas sus comidas?")) return;
              plan.bloques.splice(iB, 1); guardar(); pintar();
            } }, "🗑"),
          ]),
        ]),
        comidas,
        el("button", { class: "btn btn-sm", style: "margin-top:10px", onclick: () => elegirNombre("Nueva comida", NP.COMIDAS_MENU, (nom) => {
          b.comidas = b.comidas || [];
          b.comidas.push({ id: NP.util.uid(), nombre: nom, texto: "", opciones: [nuevaOpcion()] });
          guardar(); pintar();
        }) }, "＋ Añadir comida"),
        plan.bloques.length > 1 ? el("button", { class: "btn btn-sm", style: "margin-top:10px;margin-left:8px",
          title: "Copiar estas comidas y opciones en otro bloque", onclick: () => copiarBloque(b) }, "⧉ Copiar en otro bloque") : null,
      ]);
    }

    /** Icono según el nombre de la comida, para ubicarse de un vistazo */
    function iconoComida(nom) {
      const n = (nom || "").toLowerCase();
      if (n.includes("levant")) return "🌅";
      if (n.includes("desayun")) return "☀️";
      if (n.includes("media ma")) return "🍎";
      if (n.includes("entren")) return "💪";
      if (n.includes("merienda")) return "🥪";
      if (n.includes("cena")) return "🌙";
      if (n.includes("dormir") || n.includes("acostar")) return "😴";
      if (n.includes("comida") || n.includes("almuerzo")) return "🍽️";
      return "🍴";
    }

    function panelComida(b, c, iC) {
      const ops = el("div", { class: "menu-ops" });
      (c.opciones || []).forEach((op, iO) => ops.appendChild(filaOpcion(c, op, iO)));

      const nOps = (c.opciones || []).length;
      return el("div", { class: "menu-comida" }, [
        el("div", { class: "row menu-comida-cab", style: "align-items:flex-end;gap:10px" }, [
          el("span", { class: "comida-ico" }, iconoComida(c.nombre)),
          el("label", { class: "field", style: "margin-bottom:0" }, [
            el("span", {}, "Comida" + (nOps ? " · " + nOps + (nOps === 1 ? " opción" : " opciones") : "")),
            campo({ value: c.nombre, class: "comida-nombre" }, (v) => { c.nombre = v.trim() || "Comida"; pintar(); })]),
          el("label", { class: "field", style: "margin-bottom:0;flex:2" }, [el("span", {}, "Texto suelto (sin opciones)"),
            campo({ value: c.texto || "", placeholder: "Ej.: 15 g de limón + 250 ml de agua" }, (v) => { c.texto = v.trim(); })]),
          el("div", { class: "ej-acc" }, [
            mover(b.comidas, iC, -1), mover(b.comidas, iC, 1),
            el("button", { class: "icon-btn", title: "Quitar la comida", onclick: () => {
              if (!confirm("¿Quitar «" + c.nombre + "»?")) return;
              b.comidas.splice(iC, 1); guardar(); pintar();
            } }, "🗑"),
          ]),
        ]),
        ops,
        el("div", { class: "row", style: "gap:8px;margin-top:8px" }, [
          el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => {
            c.opciones = c.opciones || []; c.opciones.push(nuevaOpcion()); guardar(); pintar();
          } }, "＋ Opción"),
          el("button", { class: "btn btn-sm", style: "flex:0 0 auto", title: "Rellenarla con una receta del recetario",
            onclick: () => opcionDesdeReceta(c) }, "🍽️ Opción desde receta"),
        ]),
      ]);
    }

    function filaOpcion(c, op, iO) {
      return el("div", { class: "menu-op" }, [
        el("div", { class: "row", style: "align-items:flex-end;gap:10px" }, [
          el("span", { class: "op-num", style: "flex:0 0 auto;margin-bottom:10px" }, "Opción " + (iO + 1)),
          el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Título"),
            campo({ value: op.titulo || "", placeholder: "Ej.: Avena + yogur + frutos rojos" }, (v) => { op.titulo = v.trim(); })]),
          el("button", { class: "btn btn-sm", style: "flex:0 0 auto;margin-bottom:4px",
            title: "Rellenar esta opción con una receta: del programa, favoritas o creadas por ti",
            onclick: () => recetaEnOpcion(op) }, "🍽️ Añadir receta"),
          el("div", { class: "ej-acc" }, [
            el("button", { class: "icon-btn", title: "Duplicar", onclick: () => {
              c.opciones.splice(iO + 1, 0, Object.assign({}, JSON.parse(JSON.stringify(op)), { id: NP.util.uid() }));
              guardar(); pintar();
            } }, "⧉"),
            mover(c.opciones, iO, -1), mover(c.opciones, iO, 1),
            el("button", { class: "icon-btn", title: "Quitar la opción", onclick: () => {
              c.opciones.splice(iO, 1); guardar(); pintar();
            } }, "🗑"),
          ]),
        ]),
        el("label", { class: "field", style: "margin:8px 0 0" }, [el("span", {}, "Alimentos y cantidades (uno por línea)"),
          campo({ rows: Math.max(3, (op.alimentos || []).length + 1), value: (op.alimentos || []).join("\n"),
            placeholder: "40 g de copos de avena\n200 g de yogur alto en proteína\n80 g de frutos rojos" },
            (v) => { op.alimentos = lineas(v); }, true)]),
        el("label", { class: "field", style: "margin:0" }, [el("span", {}, "Preparación (opcional)"),
          campo({ rows: 2, value: op.preparacion || "", placeholder: "Cómo se hace, si hace falta explicarlo" },
            (v) => { op.preparacion = v.trim(); }, true)]),
      ]);
    }

    /** Rellena una opción ya existente con los ingredientes y la elaboración de una receta */
    function recetaEnOpcion(op) {
      NP.comp.recipePicker({
        title: "Añadir receta a la opción",
        onPick: (r, factor) => {
          const tieneAlgo = op.titulo || (op.alimentos || []).length || op.preparacion;
          if (tieneAlgo && !confirm("Esta opción ya tiene contenido. ¿Sustituirlo por «" + r.nombre + "»?")) return;
          const esc = factor && factor !== 1 ? NP.slot.escalar(r, factor) : r;
          op.titulo = r.nombre;
          op.alimentos = (esc.ingredientes || []).map((i) => `${i.gramos} g de ${i.nombre}`);
          op.preparacion = (r.elaboracion || []).join(" ");
          guardar(); pintar(); toast("Receta añadida ✓");
        },
      });
    }

    /** Rellena una opción nueva con los ingredientes y la elaboración de una receta */
    function opcionDesdeReceta(c) {
      NP.comp.recipePicker({
        title: "Elegir la receta de la opción",
        onPick: (r, factor) => {
          const esc = factor && factor !== 1 ? NP.slot.escalar(r, factor) : r;
          c.opciones = c.opciones || [];
          c.opciones.push({
            id: NP.util.uid(), titulo: r.nombre,
            alimentos: (esc.ingredientes || []).map((i) => `${i.gramos} g de ${i.nombre}`),
            preparacion: (r.elaboracion || []).join(" "),
          });
          guardar(); pintar(); toast("Opción añadida ✓");
        },
      });
    }

    /** Copia las comidas de un bloque en otro (días de entreno -> descanso) */
    function copiarBloque(origen) {
      const otros = plan.bloques.filter((x) => x.id !== origen.id);
      const sel = el("select", {}, otros.map((b) => el("option", { value: b.id }, b.nombre)));
      const m = modal({
        title: "⧉ Copiar «" + origen.nombre + "»",
        body: el("div", {}, [
          el("label", { class: "field" }, [el("span", {}, "Copiar sus comidas y opciones en"), sel]),
          el("div", { class: "small muted" }, "Se añaden al final del bloque elegido; no se borra nada de lo que ya tenga."),
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
          el("button", { class: "btn btn-primary", onclick: () => {
            const destino = plan.bloques.find((b) => b.id === sel.value);
            if (!destino) return;
            const copia = JSON.parse(JSON.stringify(origen.comidas || []));
            copia.forEach((c) => {
              c.id = NP.util.uid();
              (c.opciones || []).forEach((o) => (o.id = NP.util.uid()));
            });
            destino.comidas = (destino.comidas || []).concat(copia);
            guardar(); m.close(); toast("Copiado en «" + destino.nombre + "» ✓"); pintar();
          } }, "Copiar"),
        ],
      });
    }

    function panelSuplementos() {
      const lista = el("div", { class: "menu-ops" });
      plan.suplementos.forEach((s, i) => lista.appendChild(el("div", { class: "menu-op" }, [
        el("div", { class: "row", style: "align-items:flex-end;gap:10px" }, [
          el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Suplemento"),
            campo({ value: s.nombre, placeholder: "Creatina, omega-3, magnesio..." }, (v) => { s.nombre = v.trim(); })]),
          el("div", { class: "ej-acc" }, [
            mover(plan.suplementos, i, -1), mover(plan.suplementos, i, 1),
            el("button", { class: "icon-btn", title: "Quitar", onclick: () => { plan.suplementos.splice(i, 1); guardar(); pintar(); } }, "🗑"),
          ]),
        ]),
        el("label", { class: "field", style: "margin:8px 0 0" }, [el("span", {}, "Indicaciones (una por línea)"),
          campo({ rows: 2, value: (s.lineas || []).join("\n"), placeholder: "5 g todos los días.\nTambién los días de descanso." },
            (v) => { s.lineas = lineas(v); }, true)]),
      ])));

      return el("div", { class: "panel", style: "margin-top:14px" }, [
        el("div", { class: "side-ttl" }, "💊 Suplementación"),
        plan.suplementos.length ? lista : el("div", { class: "small muted" }, "Sin suplementos. Añade los que tome a diario."),
        el("button", { class: "btn btn-sm", style: "margin-top:10px", onclick: () => {
          plan.suplementos.push({ id: NP.util.uid(), nombre: "", lineas: [] }); guardar(); pintar();
        } }, "＋ Añadir suplemento"),
      ]);
    }

    function mover(arr, i, d) {
      return el("button", { class: "icon-btn", title: d < 0 ? "Subir" : "Bajar", onclick: () => {
        const j = i + d;
        if (j < 0 || j >= arr.length) return;
        arr.splice(j, 0, arr.splice(i, 1)[0]);
        guardar(); pintar();
      } }, d < 0 ? "↑" : "↓");
    }

    /** Pide el nombre ofreciendo los habituales con un clic */
    function elegirNombre(titulo, sugerencias, onOk) {
      const inp = el("input", { placeholder: "Escribe el nombre" });
      const m = modal({
        title: titulo,
        body: el("div", {}, [
          el("label", { class: "field" }, [el("span", {}, "Nombre"), inp]),
          el("div", { class: "small muted", style: "margin-bottom:6px" }, "O elige uno de los habituales:"),
          el("div", { class: "ej-chips" }, sugerencias.map((s) =>
            el("button", { class: "btn btn-sm", onclick: () => { m.close(); onOk(s); } }, s))),
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
          el("button", { class: "btn btn-primary", onclick: () => {
            if (!inp.value.trim()) { toast("Escribe un nombre o elige uno"); return; }
            m.close(); onOk(inp.value.trim());
          } }, "Añadir"),
        ],
      });
    }

    pintar();
  }

  return { editor, vista, resumen, nOpciones, nComidas };
})();
