/* views/agenda.js — calendario de citas y revisiones.
   El nutricionista las pone desde «🗓️ Agenda» (o desde la ficha de un paciente)
   y el paciente ve cuándo le toca en «Mi agenda». */
NP.views = NP.views || {};

NP.TIPOS_CITA = [
  { key: "revision", ic: "📈", label: "Revisión" },
  { key: "primera", ic: "🤝", label: "Primera visita" },
  { key: "consulta", ic: "💬", label: "Consulta" },
  { key: "online", ic: "💻", label: "Seguimiento online" },
  { key: "entreno", ic: "🏋️", label: "Entrenamiento" },
];

NP.views.agenda = (function () {
  const { el, modal, toast } = NP.util;
  const DIAS_SEM = ["L", "M", "X", "J", "V", "S", "D"];

  const tipoDe = (k) => NP.TIPOS_CITA.find((t) => t.key === k) || NP.TIPOS_CITA[2];
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const dia = (c) => String(c.fecha).slice(0, 10);
  const hora = (c) => String(c.fecha).slice(11, 16);
  const cuando = (c) => {
    const d = new Date(String(c.fecha).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? String(c.fecha)
      : d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) + (hora(c) ? " a las " + hora(c) : "");
  };
  const esFutura = (c) => String(c.fecha) >= hoyISO();

  /** Todas las citas que puede ver quien ha entrado (de un paciente, o de todos) */
  function citas(pacienteId) {
    if (pacienteId) return NP.store.registrosDe(pacienteId, "cita");
    return NP.store.getPacientes()
      .flatMap((p) => NP.store.registrosDe(p.id, "cita"))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }
  const nombreDe = (pid) => { const p = NP.store.getPaciente(pid); return p ? p.nombre : "Paciente"; };

  /* ================= Crear / editar una cita ================= */
  function formCita(opts) {
    const c = opts.cita || {};
    const pacientes = NP.store.getPacientes();
    const fijo = opts.pacienteId || c.pacienteId;
    const fPac = el("select", {}, pacientes.map((p) =>
      el("option", { value: p.id, ...(p.id === fijo ? { selected: true } : {}) }, p.nombre)));
    const fFecha = el("input", { type: "date", value: dia(c) || opts.fecha || hoyISO() });
    const fHora = el("input", { type: "time", value: hora(c) || "10:00" });
    const fDur = el("input", { type: "number", min: 10, max: 240, step: 5, value: c.duracion_min ?? 45 });
    const fTipo = el("select", {}, NP.TIPOS_CITA.map((t) =>
      el("option", { value: t.key, ...(t.key === (c.tipo_cita || "revision") ? { selected: true } : {}) }, t.ic + " " + t.label)));
    const fLugar = el("input", { value: c.lugar || "", placeholder: "Consulta, videollamada, gimnasio..." });
    const fNota = el("textarea", { rows: 2, placeholder: "Qué hay que preparar o traer" }, [c.nota || ""]);
    const avisar = el("input", { type: "checkbox", checked: !c.id, style: "width:auto;margin:0;flex:0 0 auto" });

    const m = modal({
      title: c.id ? "Editar cita" : "🗓️ Nueva cita", wide: true,
      body: el("div", {}, [
        pacientes.length > 1 && !opts.pacienteId
          ? el("label", { class: "field" }, [el("span", {}, "Paciente"), fPac]) : null,
        el("div", { class: "row" }, [
          el("label", { class: "field" }, [el("span", {}, "Día"), fFecha]),
          el("label", { class: "field" }, [el("span", {}, "Hora"), fHora]),
          el("label", { class: "field" }, [el("span", {}, "Duración (min)"), fDur]),
        ]),
        el("div", { class: "row" }, [
          el("label", { class: "field" }, [el("span", {}, "Tipo"), fTipo]),
          el("label", { class: "field" }, [el("span", {}, "Dónde"), fLugar]),
        ]),
        el("label", { class: "field" }, [el("span", {}, "Nota"), fNota]),
        el("label", { class: "row", style: "gap:8px;align-items:center;cursor:pointer" }, [
          avisar, el("span", { class: "small muted" }, "Avisar al paciente por el chat de la app"),
        ]),
      ].filter(Boolean)),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const pid = opts.pacienteId || (pacientes.length > 1 ? fPac.value : (pacientes[0] && pacientes[0].id));
          if (!pid) { toast("Necesitas un paciente para poner una cita"); return; }
          if (!fFecha.value) { toast("Elige el día"); return; }
          const guardada = NP.store.saveRegistro(Object.assign({}, c, {
            tipo: "cita", pacienteId: pid, fecha: fFecha.value + "T" + (fHora.value || "00:00"),
            duracion_min: Number(fDur.value) || 45, tipo_cita: fTipo.value,
            lugar: fLugar.value.trim(), nota: fNota.value.trim(),
          }));
          if (avisar.checked) {
            const t = tipoDe(guardada.tipo_cita);
            NP.store.saveMensaje({
              pacienteId: pid, autor: "nutri", canal: "app",
              texto: `🗓️ ${c.id ? "Te he cambiado la cita" : "Tienes una cita"}: ${t.label.toLowerCase()} el ${cuando(guardada)}` +
                (guardada.lugar ? ` · ${guardada.lugar}` : "") + (guardada.nota ? `\n\n${guardada.nota}` : "") +
                "\nLa tienes en «Mi agenda».",
            });
          }
          m.close(); toast("Cita guardada ✓");
          opts.onHecho && opts.onHecho();
        } }, "Guardar cita"),
      ],
    });
  }

  /* ================= Rejilla del mes ================= */
  function calendario(lista, mes, opts) {
    const o = opts || {};
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const desplaza = (primero.getDay() + 6) % 7;          // lunes primero
    const nDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const hoy = hoyISO();
    const grid = el("div", { class: "cal-grid" });
    DIAS_SEM.forEach((d) => grid.appendChild(el("div", { class: "cal-cab" }, d)));
    for (let i = 0; i < desplaza; i++) grid.appendChild(el("div", { class: "cal-dia vacio" }));

    for (let d = 1; d <= nDias; d++) {
      const iso = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const delDia = lista.filter((c) => dia(c) === iso).sort((a, b) => hora(a).localeCompare(hora(b)));
      const celda = el("div", { class: "cal-dia" + (iso === hoy ? " hoy" : "") + (delDia.length ? " con-citas" : "") }, [
        el("div", { class: "cal-n" }, String(d)),
        el("div", { class: "cal-citas" }, delDia.slice(0, 3).map((c) => el("div", { class: "cal-cita", title: o.titulo ? o.titulo(c) : "" },
          (hora(c) ? hora(c) + " " : "") + (o.etiqueta ? o.etiqueta(c) : tipoDe(c.tipo_cita).label)))),
        delDia.length > 3 ? el("div", { class: "small muted" }, "+" + (delDia.length - 3)) : null,
      ]);
      if (o.onDia) celda.addEventListener("click", () => o.onDia(iso, delDia));
      grid.appendChild(celda);
    }
    return grid;
  }

  function cabeceraMes(mes, onCambio) {
    const ttl = el("div", { class: "side-ttl cal-mes", style: "margin:0" },
      mes.toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
    return el("div", { class: "row cal-nav", style: "align-items:center;gap:10px" }, [
      el("button", { class: "icon-btn", title: "Mes anterior", onclick: () => onCambio(-1) }, "‹"),
      ttl,
      el("button", { class: "icon-btn", title: "Mes siguiente", onclick: () => onCambio(1) }, "›"),
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-sm", onclick: () => onCambio(0) }, "Hoy"),
    ]);
  }

  /* ================= Agenda del nutricionista ================= */
  function nutri(view, pacienteId) {
    const p = pacienteId ? NP.store.getPaciente(pacienteId) : null;
    if (pacienteId && !p) { NP.app.go("#/agenda"); return; }
    NP.app.setTitle(p ? "Citas · " + p.nombre : "Agenda");
    const recargar = () => NP.app.route();
    let mes = new Date();

    view.appendChild(el("div", { class: "plan-head" }, [
      p ? el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + p.id) }, "← Volver a " + p.nombre.split(" ")[0]) : null,
      p ? el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/agenda") }, "Ver toda la agenda") : null,
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-primary", onclick: () => formCita({ pacienteId: p && p.id, onHecho: recargar }) }, "＋ Nueva cita"),
    ].filter(Boolean)));
    if (!NP.store.registrosListos()) view.appendChild(NP.views.revisiones.avisoBaseDeDatos());

    const panel = el("div", { class: "panel" });
    view.appendChild(panel);
    const proximas = el("div", {});
    view.appendChild(proximas);

    function pintar() {
      panel.innerHTML = "";
      const lista = citas(pacienteId);
      panel.appendChild(cabeceraMes(mes, (d) => {
        mes = d === 0 ? new Date() : new Date(mes.getFullYear(), mes.getMonth() + d, 1);
        pintar();
      }));
      panel.appendChild(calendario(lista, mes, {
        etiqueta: (c) => (pacienteId ? tipoDe(c.tipo_cita).label : nombreDe(c.pacienteId).split(" ")[0]),
        titulo: (c) => nombreDe(c.pacienteId) + " · " + tipoDe(c.tipo_cita).label,
        onDia: (iso, delDia) => dialogoDia(iso, delDia),
      }));

      proximas.innerHTML = "";
      const futuras = lista.filter(esFutura).slice(0, 12);
      proximas.appendChild(el("div", { class: "side-ttl", style: "margin:22px 0 10px" }, "Próximas citas"));
      if (!futuras.length) {
        proximas.appendChild(el("div", { class: "empty" }, [
          el("div", { class: "big" }, "🗓️"),
          el("div", {}, "No hay ninguna cita puesta."),
          el("div", { class: "small muted", style: "margin-top:6px" }, "Pulsa en un día del calendario para añadir una."),
        ]));
        return;
      }
      proximas.appendChild(el("div", { class: "list" }, futuras.map((c) => filaCita(c, true))));
    }

    function filaCita(c, conAcciones) {
      const t = tipoDe(c.tipo_cita);
      return el("div", { class: "list-item" }, [
        el("div", { class: "avatar" }, t.ic),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, nombreDe(c.pacienteId) + " · " + t.label),
          el("div", { class: "small muted" }, cuando(c) + (c.lugar ? " · " + c.lugar : "") + (c.nota ? " · " + c.nota : "")),
        ]),
        conAcciones ? el("button", { class: "btn btn-sm", onclick: () => formCita({ cita: c, onHecho: recargar }) }, "Editar") : null,
        conAcciones ? el("button", { class: "btn btn-sm btn-danger", onclick: () => {
          if (!confirm("¿Borrar esta cita?")) return;
          NP.store.deleteRegistro(c.id); toast("Cita borrada"); recargar();
        } }, "🗑") : null,
      ].filter(Boolean));
    }

    function dialogoDia(iso, delDia) {
      const m = modal({
        title: "🗓️ " + new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
        body: el("div", {}, [
          delDia.length
            ? el("div", { class: "list" }, delDia.map((c) => filaCita(c, false)))
            : el("div", { class: "small muted" }, "No hay nada puesto este día."),
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cerrar"),
          el("button", { class: "btn btn-primary", onclick: () => {
            m.close(); formCita({ pacienteId, fecha: iso, onHecho: recargar });
          } }, "＋ Nueva cita este día"),
        ],
      });
    }

    pintar();
  }

  /* ================= Mi agenda (paciente) ================= */
  function cliente(view) {
    const p = NP.auth.pacienteActual();
    if (!p) return;
    NP.app.setTitle("Mi agenda");
    let mes = new Date();
    const lista = citas(p.id);
    const siguiente = lista.filter(esFutura)[0];

    view.appendChild(siguiente
      ? el("div", { class: "panel prox-cita" }, [
          el("div", { class: "prox-ic" }, tipoDe(siguiente.tipo_cita).ic),
          el("div", { class: "grow" }, [
            el("div", { class: "small muted" }, "Tu próxima cita"),
            el("div", { class: "prox-tx" }, tipoDe(siguiente.tipo_cita).label + " · " + cuando(siguiente)),
            siguiente.lugar ? el("div", { class: "small muted" }, "📍 " + siguiente.lugar) : null,
            siguiente.nota ? el("div", { class: "small", style: "margin-top:6px" }, "📝 " + siguiente.nota) : null,
          ]),
        ])
      : el("div", { class: "panel" }, [
          el("div", { class: "small muted" }, "Todavía no tienes ninguna cita puesta. Tu nutricionista la verá aquí en cuanto la cree."),
        ]));

    const panel = el("div", { class: "panel", style: "margin-top:14px" });
    view.appendChild(panel);
    function pintar() {
      panel.innerHTML = "";
      panel.appendChild(cabeceraMes(mes, (d) => {
        mes = d === 0 ? new Date() : new Date(mes.getFullYear(), mes.getMonth() + d, 1);
        pintar();
      }));
      panel.appendChild(calendario(lista, mes, {
        etiqueta: (c) => tipoDe(c.tipo_cita).label,
        titulo: (c) => tipoDe(c.tipo_cita).label + (c.lugar ? " · " + c.lugar : ""),
      }));
    }
    pintar();

    const futuras = lista.filter(esFutura);
    if (futuras.length > 1) {
      view.appendChild(el("div", { class: "side-ttl", style: "margin:22px 0 10px" }, "Siguientes citas"));
      view.appendChild(el("div", { class: "list" }, futuras.slice(1).map((c) => el("div", { class: "list-item" }, [
        el("div", { class: "avatar" }, tipoDe(c.tipo_cita).ic),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, tipoDe(c.tipo_cita).label),
          el("div", { class: "small muted" }, cuando(c) + (c.lugar ? " · " + c.lugar : "")),
        ]),
      ]))));
    }
  }

  return { nutri, cliente, formCita, citas };
})();
