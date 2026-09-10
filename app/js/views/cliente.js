/* views/cliente.js — lo que ve el paciente cuando entra con su cuenta:
   sus menús de la semana (solo lectura), el chat con su nutricionista y su perfil. */
NP.views = NP.views || {};

NP.views.cliente = (function () {
  const { el, fmt, toast, modal } = NP.util;

  const pac = () => NP.auth.pacienteActual();
  const nombreNutri = () => {
    const p = pac();
    const u = p && p.nutriId ? NP.auth.getUsuario(p.nutriId) : null;
    return u ? u.nombre : "tu nutricionista";
  };
  const claveHoy = () => NP.DIAS[(new Date().getDay() + 6) % 7].key; // getDay(): 0 = domingo

  /* ================= Mi menú ================= */
  function plan(view) {
    const p = pac();
    if (!p) return;
    NP.app.setTitle("Mi menú");
    const planes = NP.store.planesDe(p.id);

    if (!planes.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🗓️"),
        el("div", {}, "Todavía no tienes ningún menú."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Cuando " + nombreNutri() + " prepare tu plan, aparecerá aquí."),
        el("button", { class: "btn", style: "margin-top:16px", onclick: () => NP.app.go("#/mi-chat") }, "💬 Escribir a mi nutricionista"),
      ]));
      return;
    }

    let actual = planes[planes.length - 1]; // el último creado suele ser el vigente
    let vista = "hoy";

    const selPlan = el("select", {}, planes.map((pl) =>
      el("option", { value: pl.id, ...(pl.id === actual.id ? { selected: true } : {}) }, pl.nombre)));
    selPlan.addEventListener("change", () => { actual = NP.store.getPlan(selPlan.value) || actual; pintar(); });

    const seg = el("div", { class: "seg", style: "flex:0 0 auto" }, [
      el("button", { class: "active", onclick: (e) => setVista("hoy", e.target) }, "Hoy"),
      el("button", { onclick: (e) => setVista("semana", e.target) }, "Semana completa"),
    ]);
    function setVista(v, btn) {
      vista = v;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pintar();
    }

    const cuerpo = el("div", {});
    view.appendChild(el("div", { class: "plan-head" }, [
      planes.length > 1 ? el("label", { class: "field", style: "margin:0;flex:0 0 auto;min-width:220px" },
        [el("span", {}, "Mi plan"), selPlan]) : el("div", { class: "side-ttl" }, actual.nombre),
      el("div", { class: "grow" }),
      seg,
      el("button", { class: "btn", style: "flex:0 0 auto", onclick: () => descargar() }, "📄 Descargar / imprimir"),
    ]));
    view.appendChild(cuerpo);

    function descargar() {
      const u = p.nutriId ? NP.auth.getUsuario(p.nutriId) : null;
      NP.pdf.exportarPlan(actual, p, u ? { nutri: { nombre: u.nombre } } : undefined);
    }

    const comidasDe = (pl) => (Array.isArray(pl.comidas) ? pl.comidas : NP.COMIDAS);
    const slotDe = (pl, dKey, cKey) => (pl.dias[dKey] && pl.dias[dKey][cKey]) || null;
    const kcalDia = (pl, dKey) => comidasDe(pl).reduce((s, c) => s + NP.slot.kcal(slotDe(pl, dKey, c.key), c.tipo), 0);

    function pintar() {
      cuerpo.innerHTML = "";
      cuerpo.appendChild(vista === "hoy" ? vistaHoy() : vistaSemana());
    }

    /* --- Hoy: las comidas del día, grandes y claras --- */
    function vistaHoy() {
      const hoy = claveHoy();
      const wrap = el("div", {});
      const kcal = kcalDia(actual, hoy);
      const obj = p.kcal_objetivo || 0;

      wrap.appendChild(el("div", { class: "panel" }, [
        el("div", { class: "row", style: "align-items:center" }, [
          el("div", {}, [
            el("div", { class: "side-ttl", style: "margin:0" }, NP.DIA_LARGO[hoy]),
            el("div", { class: "small muted" }, actual.nombre),
          ]),
          el("div", { style: "flex:0 0 auto;text-align:right" }, [
            el("div", { class: "kcal", style: "font-size:22px" }, fmt(kcal) + " kcal"),
            obj ? el("div", { class: "small muted" }, "tu objetivo: " + fmt(obj) + " kcal") : null,
          ]),
        ]),
      ]));

      const lista = el("div", { style: "margin-top:14px;display:flex;flex-direction:column;gap:12px" });
      comidasDe(actual).forEach((c) => {
        const cms = NP.slot.comidas(slotDe(actual, hoy, c.key), c.tipo);
        lista.appendChild(el("div", { class: "panel comida-bloque" }, [
          el("div", { class: "comida-cab" }, [
            el("span", { class: "comida-ic" }, NP.comp.EMO[c.tipo] || "🍴"),
            el("span", { class: "comida-lb" }, c.label),
            el("span", { class: "grow" }),
            cms.length ? el("span", { class: "kcal" },
              fmt(cms.reduce((s, cm) => s + (cm.nutricion.energia_kcal || 0), 0)) + " kcal") : null,
          ]),
          cms.length
            ? el("div", { class: "platos" }, cms.map((cm) => platoCard(cm)))
            : el("div", { class: "small muted", style: "padding:6px 2px" }, "Libre · sin nada asignado"),
        ]));
      });
      wrap.appendChild(lista);
      return wrap;
    }

    function platoCard(cm) {
      return el("div", { class: "plato", onclick: () => NP.comp.recipeDetail(cm) }, [
        el("div", { class: "grow" }, [
          el("div", { class: "plato-nm" }, cm.nombre),
          el("div", { class: "small muted" },
            (cm.tiempo_min ? "⏱ " + cm.tiempo_min + " min · " : "") +
            (cm.ingredientes || []).length + " ingredientes · toca para ver la receta"),
        ]),
        el("div", { class: "kcal", style: "flex:0 0 auto" }, fmt(cm.nutricion.energia_kcal) + " kcal"),
      ]);
    }

    /* --- Semana completa: la rejilla, solo lectura --- */
    function vistaSemana() {
      const comidas = comidasDe(actual);
      const grid = el("div", { class: "plan-grid" });
      grid.style.gridTemplateColumns = `92px repeat(7, minmax(140px, 1fr))`;
      grid.appendChild(el("div", { class: "ph" }, ""));
      NP.DIAS.forEach((d) => grid.appendChild(el("div", { class: "ph" + (d.key === claveHoy() ? " hoy" : "") }, NP.DIA_LARGO[d.key])));

      comidas.forEach((c) => {
        grid.appendChild(el("div", { class: "rowlabel" }, c.label));
        NP.DIAS.forEach((d) => {
          const cms = NP.slot.comidas(slotDe(actual, d.key, c.key), c.tipo);
          const celda = el("div", { class: "slot solo-lectura" });
          if (!cms.length) celda.appendChild(el("div", { class: "slot-empty" }, "—"));
          else celda.appendChild(el("div", { class: "slot-dishes" }, cms.map((cm) =>
            el("div", { class: "slot-card", onclick: () => NP.comp.recipeDetail(cm) }, [
              el("div", { class: "st", title: cm.nombre }, cm.nombre),
              el("div", { class: "sk" }, fmt(cm.nutricion.energia_kcal) + " kcal"),
            ]))));
          grid.appendChild(celda);
        });
      });

      grid.appendChild(el("div", { class: "rowlabel" }, "Total"));
      NP.DIAS.forEach((d) => grid.appendChild(
        el("div", { class: "day-total" }, [el("b", {}, fmt(kcalDia(actual, d.key))), " kcal"])));

      return el("div", {}, [
        el("div", { class: "plan-scroll" }, [grid]),
        el("div", { class: "small muted", style: "margin-top:10px" },
          "Toca cualquier plato para ver los ingredientes, los gramos y cómo se prepara."),
      ]);
    }

    pintar();
  }

  /* ================= Mi nutricionista (chat) ================= */
  function chat(view) {
    const p = pac();
    if (!p) return;
    NP.app.setTitle("Mi nutricionista");
    NP.store.marcarLeidos(p.id, "paciente");

    const hilo = el("div", { class: "chat alta" });
    const input = el("textarea", { rows: 3, placeholder: "Escribe aquí tu duda, cómo te ha ido la semana..." });

    function pintarHilo() {
      const msgs = NP.store.mensajesDe(p.id);
      hilo.innerHTML = "";
      if (!msgs.length) {
        hilo.appendChild(el("div", { class: "empty" }, [
          el("div", { class: "big" }, "💬"),
          el("div", {}, "Aún no hay mensajes."),
          el("div", { class: "small muted", style: "margin-top:6px" }, "Escribe abajo para empezar la conversación."),
        ]));
        return;
      }
      msgs.forEach((m) => {
        const f = new Date(m.fecha);
        const mio = m.autor === "paciente";
        hilo.appendChild(el("div", { class: "msg msg-" + (mio ? "out" : "in") }, [
          el("div", { class: "msg-tx" }, m.texto),
          m.adjunto ? NP.docs.tarjeta(m.adjunto) : null,
          el("div", { class: "msg-meta" }, [
            el("span", {}, (mio ? "Tú" : nombreNutri().split(" ")[0]) + " · " +
              f.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + " " +
              f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })),
          ]),
        ]));
      });
      hilo.scrollTop = hilo.scrollHeight;
    }

    function enviar() {
      const t = input.value.trim();
      if (!t) { toast("Escribe un mensaje"); return; }
      NP.store.saveMensaje({ pacienteId: p.id, texto: t, autor: "paciente", canal: "app" });
      input.value = "";
      pintarHilo();
      NP.app.refrescarNav();
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); }
    });

    const atajo = (tx, lbl) => el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => { input.value = tx; input.focus(); } }, lbl);

    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "row", style: "align-items:center" }, [
        el("div", { class: "avatar", style: "flex:0 0 auto" }, "🥗"),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, nombreNutri()),
          el("div", { class: "small muted" }, "Tu nutricionista"),
        ]),
      ]),
    ]));
    view.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [hilo]));
    view.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [
      el("div", { class: "small muted", style: "margin-bottom:8px" }, "Atajos:"),
      el("div", { class: "row", style: "gap:8px" }, [
        atajo("Esta semana he seguido el plan sin problema.", "👍 Todo bien"),
        atajo("Tengo una duda con una receta: ", "❓ Tengo una duda"),
        atajo("Me gustaría cambiar alguna comida del plan porque ", "🔄 Pedir un cambio"),
        atajo("Mi peso de esta semana es de  kg.", "⚖️ Mandar mi peso"),
      ]),
      el("div", { style: "margin-top:12px" }, [input]),
      el("div", { class: "row", style: "gap:8px;margin-top:10px" }, [
        el("div", { class: "grow small muted", style: "align-self:center" }, "Ctrl + Intro para enviar"),
        el("button", { class: "btn btn-primary", style: "flex:0 0 auto", onclick: enviar }, "Enviar mensaje"),
      ]),
    ]));
    pintarHilo();
  }

  /* ================= Mis documentos (PDF de la nutricionista) ================= */
  function documentos(view) {
    const p = pac();
    if (!p) return;
    NP.app.setTitle("Mis documentos");
    view.appendChild(el("div", { class: "small muted", style: "margin-bottom:14px" },
      "Rutinas de entrenamiento, recetas y alimentos que te ha mandado " + nombreNutri() + ". Toca uno para abrirlo."));
    view.appendChild(NP.docs.listaAgrupada(p.id, el("div", { class: "empty" }, [
      el("div", { class: "big" }, "📁"),
      el("div", {}, "Todavía no tienes documentos."),
      el("div", { class: "small muted", style: "margin-top:6px" },
        "Cuando " + nombreNutri() + " te envíe un PDF (una rutina, recetas sugeridas...), aparecerá aquí."),
    ])));
  }

  /* ================= Mi perfil ================= */
  function perfil(view) {
    const p = pac();
    if (!p) return;
    NP.app.setTitle("Mi perfil");
    const u = NP.auth.actual();
    const kpi = (l, v) => el("div", { class: "kpi" }, [el("div", { class: "v" }, String(v)), el("div", { class: "l" }, l)]);
    const bmi = p.peso_kg && p.altura_cm ? p.peso_kg / Math.pow(p.altura_cm / 100, 2) : null;

    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "row", style: "align-items:center;margin-bottom:14px" }, [
        el("div", { class: "avatar", style: "flex:0 0 auto" }, NP.util.iniciales(p.nombre)),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, p.nombre),
          el("div", { class: "small muted" }, u.email),
        ]),
        el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => registrarPeso() }, "⚖️ Actualizar mi peso"),
      ]),
      el("div", { class: "kpis" }, [
        kpi("Objetivo", p.objetivo || "—"),
        kpi("Kcal/día", fmt(p.kcal_objetivo)),
        p.peso_kg != null ? kpi("Peso", fmt(p.peso_kg, 1) + " kg") : null,
        p.altura_cm != null ? kpi("Altura", fmt(p.altura_cm, 0) + " cm") : null,
        bmi != null ? kpi("IMC", fmt(bmi, 1)) : null,
      ].filter(Boolean)),
      p.notas ? el("div", { class: "small muted", style: "margin-top:12px" }, "📝 " + p.notas) : null,
    ]));

    view.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [
      el("div", { class: "side-ttl" }, "Mi cuenta"),
      el("div", { class: "small muted", style: "margin-bottom:12px" },
        "Tu nutricionista es " + nombreNutri() + ". Los datos de tu ficha (peso, objetivo, patologías) " +
        "los mantiene él/ella; si algo no cuadra, escríbeselo por el chat."),
      el("div", { class: "row", style: "gap:8px" }, [
        el("button", { class: "btn", style: "flex:0 0 auto", onclick: cambiarPass }, "🔒 Cambiar mi contraseña"),
        el("button", { class: "btn btn-danger", style: "flex:0 0 auto", onclick: () => NP.app.cerrarSesion() }, "Cerrar sesión"),
      ]),
    ]));

    function registrarPeso() {
      const f = el("input", { type: "number", step: 0.1, min: 20, max: 350, value: p.peso_kg ?? "", placeholder: "kg" });
      const avisar = el("input", { type: "checkbox", checked: true });
      const m = modal({
        title: "Actualizar mi peso",
        body: el("div", {}, [
          el("label", { class: "field" }, [el("span", {}, "Peso de hoy (kg)"), f]),
          el("label", { class: "row", style: "gap:8px;align-items:center" }, [
            el("span", { style: "flex:0 0 auto" }, [avisar]),
            el("span", { class: "small muted" }, "Avisar a mi nutricionista por el chat"),
          ]),
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
          el("button", { class: "btn btn-primary", onclick: () => {
            const v = Number(f.value);
            if (!v || v < 20 || v > 350) { toast("Escribe un peso válido"); return; }
            const anterior = p.peso_kg;
            p.peso_kg = v;
            NP.store.savePacienteGlobal(p);
            if (avisar.checked) {
              NP.store.saveMensaje({
                pacienteId: p.id, autor: "paciente", canal: "app",
                texto: `⚖️ Peso actualizado: ${fmt(v, 1)} kg` +
                  (anterior != null ? ` (antes ${fmt(anterior, 1)} kg)` : ""),
              });
            }
            m.close(); toast("Peso guardado"); NP.app.route();
          } }, "Guardar"),
        ],
      });
    }

    function cambiarPass() {
      const f1 = el("input", { type: "password", placeholder: "Contraseña actual" });
      const f2 = el("input", { type: "password", placeholder: "Nueva contraseña (mín. 6)" });
      const f3 = el("input", { type: "password", placeholder: "Repite la nueva" });
      const err = el("div", { class: "auth-error", hidden: true });
      const m = modal({
        title: "Cambiar mi contraseña",
        body: el("div", {}, [
          el("label", { class: "field" }, [el("span", {}, "Contraseña actual"), f1]),
          el("label", { class: "field" }, [el("span", {}, "Nueva contraseña"), f2]),
          el("label", { class: "field" }, [el("span", {}, "Repetir nueva"), f3]),
          err,
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
          el("button", { class: "btn btn-primary", onclick: async () => {
            err.hidden = true;
            if (f2.value !== f3.value) { err.textContent = "Las dos contraseñas nuevas no coinciden."; err.hidden = false; return; }
            try {
              await NP.auth.cambiarPass(u.id, f1.value, f2.value);
              m.close(); toast("Contraseña cambiada ✓");
            } catch (e) { err.textContent = e.message; err.hidden = false; }
          } }, "Guardar"),
        ],
      });
    }
  }

  return { plan, chat, documentos, perfil };
})();
