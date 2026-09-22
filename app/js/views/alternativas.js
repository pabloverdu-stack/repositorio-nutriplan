/* views/alternativas.js — recetas sanas y cambios de alimentos de cada paciente.
   El nutricionista deja aquí por qué puede cambiar cada alimento cuando se cansa
   de algo del plan, y las recetas del recetario que le recomienda. El paciente lo
   ve en «Mis recetas». */
NP.views = NP.views || {};

NP.GRUPOS_ALIMENTO = [
  { key: "cereales", ic: "🌾", label: "Cereales, pan y pasta" },
  { key: "proteinas", ic: "🍗", label: "Carnes, pescados y huevos" },
  { key: "lacteos", ic: "🥛", label: "Lácteos" },
  { key: "vegetales", ic: "🥦", label: "Frutas y verduras" },
  { key: "legumbres", ic: "🫘", label: "Legumbres" },
  { key: "grasas", ic: "🥑", label: "Grasas y frutos secos" },
  { key: "snacks", ic: "🍫", label: "Snacks y caprichos" },
  { key: "bebidas", ic: "🥤", label: "Bebidas" },
];

NP.views.alternativas = (function () {
  const { el, modal, toast, fmt } = NP.util;

  const grupo = (k) => NP.GRUPOS_ALIMENTO.find((g) => g.key === k) || NP.GRUPOS_ALIMENTO[NP.GRUPOS_ALIMENTO.length - 1];
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const listaDe = (id) => NP.store.registrosDe(id, "alternativa");
  const esReceta = (a) => !!a.recetaId;

  /* ================= Cambio de alimento ================= */
  function formCambio(p, existente, onHecho) {
    const a = existente || {};
    const fAlimento = el("input", { value: a.alimento || "", placeholder: "Ej.: Arroz blanco de la comida" });
    const fGrupo = el("select", {}, NP.GRUPOS_ALIMENTO.map((g) =>
      el("option", { value: g.key, ...(g.key === (a.categoria || "cereales") ? { selected: true } : {}) }, g.ic + " " + g.label)));
    const fOpciones = el("textarea", { rows: 4, placeholder: "Una alternativa por línea:\nArroz integral\nQuinoa\nPatata cocida\nPasta integral" },
      [(a.opciones || []).join("\n")]);
    const fNota = el("textarea", { rows: 2, placeholder: "Cantidad equivalente, cómo cocinarlo, cuándo usarlo..." }, [a.nota || ""]);

    const m = modal({
      title: existente ? "Editar alternativa" : "🔄 Nuevo cambio de alimento", wide: true,
      body: el("div", {}, [
        el("div", { class: "row" }, [
          el("label", { class: "field" }, [el("span", {}, "En vez de..."), fAlimento]),
          el("label", { class: "field" }, [el("span", {}, "Grupo"), fGrupo]),
        ]),
        el("label", { class: "field" }, [el("span", {}, "Puede tomar (una por línea)"), fOpciones]),
        el("label", { class: "field" }, [el("span", {}, "Nota"), fNota]),
      ]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const opciones = fOpciones.value.split("\n").map((s) => s.trim()).filter(Boolean);
          if (!fAlimento.value.trim()) { toast("Escribe qué alimento se cambia"); return; }
          if (!opciones.length) { toast("Escribe al menos una alternativa"); return; }
          NP.store.saveRegistro(Object.assign({}, a, {
            tipo: "alternativa", pacienteId: p.id, fecha: a.fecha || hoyISO(),
            alimento: fAlimento.value.trim(), categoria: fGrupo.value,
            opciones, nota: fNota.value.trim(), recetaId: null,
          }));
          m.close(); toast("Alternativa guardada ✓");
          onHecho && onHecho();
        } }, "Guardar"),
      ],
    });
  }

  /** Recomendar una receta del recetario */
  function anadirReceta(p, onHecho) {
    NP.comp.recipePicker({
      title: "Recomendar una receta a " + p.nombre.split(" ")[0],
      onPick: (r) => {
        const ya = listaDe(p.id).some((a) => a.recetaId === r.id);
        if (ya) { toast("Esa receta ya se la has recomendado"); return; }
        NP.store.saveRegistro({
          tipo: "alternativa", pacienteId: p.id, fecha: hoyISO(),
          recetaId: r.id, titulo: r.nombre, kcal: Math.round(r.nutricion.energia_kcal),
          categoria: r.tipo === "desayuno" ? "cereales" : r.tipo === "merienda" ? "snacks" : "proteinas",
          nota: "",
        });
        toast("Receta recomendada ✓");
        onHecho && onHecho();
      },
    });
  }

  function tarjetaReceta(a, acciones) {
    const r = NP.data.getReceta(a.recetaId);
    return el("div", { class: "list-item" }, [
      el("div", { class: "avatar" }, r ? (NP.comp.EMO[r.tipo] || "🍽️") : "🍽️"),
      el("div", { class: "grow", onclick: () => (r ? NP.comp.recipeDetail(r) : toast("Esa receta ya no está en el recetario")) }, [
        el("div", { class: "name" }, a.titulo || (r ? r.nombre : "Receta")),
        el("div", { class: "small muted" }, r
          ? [(r.tiempo_min ? "⏱ " + r.tiempo_min + " min" : null), fmt(r.nutricion.energia_kcal) + " kcal",
             (r.ingredientes || []).length + " ingredientes", "toca para verla"].filter(Boolean).join(" · ")
          : "Ya no está en el recetario"),
      ]),
      a.nota ? el("span", { class: "pill", title: a.nota }, "📝") : null,
      ...(acciones || []),
    ].filter(Boolean));
  }

  function tarjetaCambio(a, acciones) {
    const g = grupo(a.categoria);
    return el("div", { class: "panel alt-card" }, [
      el("div", { class: "row", style: "align-items:center;gap:10px" }, [
        el("div", { class: "avatar", style: "flex:0 0 auto" }, g.ic),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, "En vez de " + a.alimento),
          el("div", { class: "small muted" }, g.label),
        ]),
        ...(acciones || []),
      ]),
      el("div", { class: "alt-ops" }, (a.opciones || []).map((o) => el("span", { class: "alt-op" }, o))),
      a.nota ? el("div", { class: "small muted", style: "margin-top:8px;white-space:pre-wrap" }, "📝 " + a.nota) : null,
    ]);
  }

  /* ================= Vista del nutricionista ================= */
  function nutri(view, pacienteId) {
    const p = NP.store.getPaciente(pacienteId);
    if (!p) { NP.app.go("#/pacientes"); return; }
    const corto = p.nombre.split(" ")[0];
    NP.app.setTitle("Recetas y alternativas · " + p.nombre);
    const recargar = () => NP.app.route();

    view.appendChild(el("div", { class: "plan-head" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + p.id) }, "← Volver a " + corto),
      el("div", { class: "grow" }),
      el("button", { class: "btn", onclick: () => anadirReceta(p, recargar) }, "🍽️ Recomendar receta"),
      el("button", { class: "btn btn-primary", onclick: () => formCambio(p, null, recargar) }, "＋ Cambio de alimento"),
    ]));
    if (!NP.store.registrosListos()) view.appendChild(NP.views.revisiones.avisoBaseDeDatos());
    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "small muted" },
        "Aquí dejas alternativas para los días que " + corto + " se canse de un alimento del plan, y las recetas " +
        "sanas que quieras recomendarle. Lo ve en su apartado «Mis recetas»."),
    ]));

    const todo = listaDe(p.id);
    const recetas = todo.filter(esReceta);
    const cambios = todo.filter((a) => !esReceta(a));

    if (!todo.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🥗"),
        el("div", {}, "Todavía no le has dejado alternativas."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Por ejemplo: «en vez de arroz blanco → arroz integral, quinoa o patata cocida»."),
        el("button", { class: "btn", style: "margin-top:16px", onclick: () => formCambio(p, null, recargar) }, "＋ Añadir el primero"),
      ]));
      return;
    }

    const borrar = (a) => el("button", { class: "btn btn-sm btn-danger", onclick: () => {
      if (!confirm("¿Quitárselo a " + corto + "?")) return;
      NP.store.deleteRegistro(a.id); toast("Quitado"); recargar();
    } }, "🗑");

    if (cambios.length) {
      view.appendChild(el("div", { class: "doc-sec" }, [
        el("span", { class: "doc-sec-ic" }, "🔄"), el("span", {}, "Cambios de alimentos"),
        el("span", { class: "tag" }, String(cambios.length)),
      ]));
      const lista = el("div", { class: "rev-lista" });
      cambios.forEach((a) => lista.appendChild(tarjetaCambio(a, [
        el("button", { class: "btn btn-sm", onclick: () => formCambio(p, a, recargar) }, "Editar"),
        borrar(a),
      ])));
      view.appendChild(lista);
    }
    if (recetas.length) {
      view.appendChild(el("div", { class: "doc-sec" }, [
        el("span", { class: "doc-sec-ic" }, "🍽️"), el("span", {}, "Recetas recomendadas"),
        el("span", { class: "tag" }, String(recetas.length)),
      ]));
      view.appendChild(el("div", { class: "list" }, recetas.map((a) => tarjetaReceta(a, [borrar(a)]))));
    }
  }

  /* ================= Mis recetas (paciente) ================= */
  function cliente(view) {
    const p = NP.auth.pacienteActual();
    if (!p) return;
    NP.app.setTitle("Mis recetas");
    const todo = listaDe(p.id);
    const recetas = todo.filter(esReceta);
    const cambios = todo.filter((a) => !esReceta(a));

    if (!todo.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🥗"),
        el("div", {}, "Todavía no tienes alternativas guardadas."),
        el("div", { class: "small muted", style: "margin-top:6px", },
          "Aquí verás por qué puedes cambiar cada alimento del plan y las recetas que te recomiende tu nutricionista."),
      ]));
      return;
    }

    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "small muted" },
        "Si un día te cansas de algo del plan, cámbialo por una de estas opciones: son equivalentes y encajan con tu objetivo."),
    ]));

    if (cambios.length) {
      view.appendChild(el("div", { class: "doc-sec" }, [
        el("span", { class: "doc-sec-ic" }, "🔄"), el("span", {}, "Puedo cambiar..."),
        el("span", { class: "tag" }, String(cambios.length)),
      ]));
      const lista = el("div", { class: "rev-lista" });
      cambios.forEach((a) => lista.appendChild(tarjetaCambio(a)));
      view.appendChild(lista);
    }
    if (recetas.length) {
      view.appendChild(el("div", { class: "doc-sec" }, [
        el("span", { class: "doc-sec-ic" }, "🍽️"), el("span", {}, "Recetas recomendadas"),
        el("span", { class: "tag" }, String(recetas.length)),
      ]));
      view.appendChild(el("div", { class: "list" }, recetas.map((a) => tarjetaReceta(a))));
    }
  }

  return { nutri, cliente };
})();
