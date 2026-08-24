/* views/mensajes.js — canal de comunicación con el paciente
   Hilo de mensajes guardado en la app + envío en 1 clic por WhatsApp / email. */
NP.views = NP.views || {};

/* Genera un resumen en texto del plan semanal (para enviarlo al paciente) */
NP.planATexto = function (plan, pac) {
  const comidas = Array.isArray(plan.comidas) ? plan.comidas : NP.COMIDAS;
  const L = [];
  L.push(`*${plan.nombre}*${pac ? " · " + pac.nombre : ""}`);
  L.push("");
  NP.DIAS.forEach((d) => {
    const lineas = [];
    let kcal = 0;
    comidas.forEach((c) => {
      // Cada comida puede llevar varios platos (arroz con pollo + ensalada)
      const cms = NP.slot.comidas(plan.dias[d.key] && plan.dias[d.key][c.key], c.tipo);
      if (!cms.length) return;
      const k = cms.reduce((a, cm) => a + (cm.nutricion.energia_kcal || 0), 0);
      kcal += k;
      lineas.push(`  • ${c.label}: ${cms.map((cm) => cm.nombre).join(" + ")} (${Math.round(k)} kcal)`);
    });
    if (lineas.length) {
      const dia = d.key.charAt(0).toUpperCase() + d.key.slice(1);
      L.push(`*${dia}* — ${Math.round(kcal)} kcal`);
      L.push(...lineas);
      L.push("");
    }
  });
  return L.join("\n").trim();
};

NP.views.mensajes = function (view, pacienteId) {
  const { el, fmt, toast, modal } = NP.util;
  const pac = NP.store.getPaciente(pacienteId);
  if (!pac) { NP.app.go("#/pacientes"); return; }
  NP.app.setTitle("Mensajes · " + pac.nombre);

  const telLimpio = (pac.telefono || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  const hiloWrap = el("div", { class: "chat" });
  const input = el("textarea", { rows: 3, placeholder: "Escribe un mensaje para " + pac.nombre.split(" ")[0] + "..." });

  function pintarHilo() {
    const msgs = NP.store.mensajesDe(pac.id);
    hiloWrap.innerHTML = "";
    if (!msgs.length) {
      hiloWrap.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "💬"),
        el("div", {}, "Aún no hay mensajes."),
        el("div", { class: "small muted", style: "margin-top:6px" }, "Escribe abajo y envíalo por WhatsApp o email. Se guarda aquí como historial."),
      ]));
      return;
    }
    msgs.forEach((m) => {
      const fecha = new Date(m.fecha);
      const canal = m.canal === "whatsapp" ? "WhatsApp" : (m.canal === "email" ? "Email" : "Nota");
      hiloWrap.appendChild(el("div", { class: "msg msg-" + (m.autor === "paciente" ? "in" : "out") }, [
        el("div", { class: "msg-tx" }, m.texto),
        el("div", { class: "msg-meta" }, [
          el("span", {}, fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + " " +
            fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })),
          el("span", { class: "tag" }, canal),
          el("button", { class: "icon-btn", style: "width:20px;height:20px;font-size:11px", title: "Borrar",
            onclick: () => { NP.store.deleteMensaje(m.id); pintarHilo(); } }, "✕"),
        ]),
      ]));
    });
    hiloWrap.scrollTop = hiloWrap.scrollHeight;
  }

  function registrar(texto, canal) {
    NP.store.saveMensaje({ pacienteId: pac.id, texto, autor: "nutri", canal });
    pintarHilo();
  }

  function enviarWhatsApp(texto) {
    if (!texto.trim()) { toast("Escribe un mensaje"); return; }
    if (!telLimpio) { toast("Este paciente no tiene teléfono. Edítalo para añadirlo."); return; }
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(texto)}`, "_blank");
    registrar(texto, "whatsapp"); input.value = "";
  }
  function enviarEmail(texto, asunto) {
    if (!texto.trim()) { toast("Escribe un mensaje"); return; }
    if (!pac.email) { toast("Este paciente no tiene email. Edítalo para añadirlo."); return; }
    window.open(`mailto:${pac.email}?subject=${encodeURIComponent(asunto || "Tu plan nutricional")}&body=${encodeURIComponent(texto)}`, "_blank");
    registrar(texto, "email"); input.value = "";
  }
  function guardarNota(texto) {
    if (!texto.trim()) { toast("Escribe algo"); return; }
    registrar(texto, "nota"); input.value = ""; toast("Guardado en el historial");
  }
  function registrarRespuesta() {
    const ta = el("textarea", { rows: 4, placeholder: "Pega o escribe lo que te ha contestado el paciente..." });
    const m = modal({
      title: "Anotar respuesta del paciente",
      body: el("div", {}, [el("div", { class: "small muted", style: "margin-bottom:10px" }, "Guarda en el historial lo que te ha dicho el paciente, para tenerlo todo en un sitio."), ta]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          if (!ta.value.trim()) { toast("Escribe algo"); return; }
          NP.store.saveMensaje({ pacienteId: pac.id, texto: ta.value.trim(), autor: "paciente", canal: "nota" });
          m.close(); pintarHilo();
        } }, "Guardar"),
      ],
    });
  }

  // --- Plantillas rápidas ---
  function plantilla(txt) { input.value = txt; input.focus(); }
  const nombreCorto = pac.nombre.split(" ")[0];
  const atajos = el("div", { class: "row", style: "gap:8px" }, [
    el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => plantilla(`¡Hola ${nombreCorto}! ¿Qué tal la semana? ¿Has podido seguir el plan sin problema?`) }, "👋 Seguimiento"),
    el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => plantilla(`Hola ${nombreCorto}, recuerda mandarme tu peso de esta semana cuando puedas. ¡Gracias!`) }, "⚖️ Pedir peso"),
    el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => plantilla(`Hola ${nombreCorto}, te recuerdo nuestra próxima consulta. ¿Te viene bien la hora?`) }, "📅 Recordar cita"),
    el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => enviarPlan() }, "🗓️ Enviar plan semanal"),
  ]);

  function enviarPlan() {
    const planes = NP.store.planesDe(pac.id);
    if (!planes.length) { toast("Este paciente no tiene ningún plan todavía"); return; }
    const sel = el("select", {}, planes.map((p) => el("option", { value: p.id }, p.nombre)));
    const prev = el("pre", { class: "preview-plan" });
    const pintarPrev = () => { const p = NP.store.getPlan(sel.value); prev.textContent = NP.planATexto(p, pac); };
    sel.addEventListener("change", pintarPrev);
    const m = modal({
      title: "Enviar plan al paciente", wide: true,
      body: el("div", {}, [
        el("label", { class: "field" }, [el("span", {}, "Plan a enviar"), sel]),
        el("div", { class: "nota-pdf" }, [
          el("b", {}, "📲 Enviar PDF: "),
          "genera el plan en PDF y lo manda al paciente. Desde el móvil se comparte " +
          "directo a WhatsApp; desde el ordenador se descarga y lo adjuntas en el chat.",
        ]),
        el("div", { class: "small muted", style: "margin:10px 0 6px" }, "Vista previa del mensaje de texto:"),
        prev,
      ]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn", onclick: () => { navigator.clipboard.writeText(prev.textContent); toast("Copiado"); } }, "📋 Copiar"),
        el("button", { class: "btn", onclick: async () => {
          const p = NP.store.getPlan(sel.value);
          m.close();
          const r = await NP.pdf.flujoEnviarAlMovil(p, pac);
          if (r === "compartido" || r === "descargado") {
            NP.store.saveMensaje({ pacienteId: pac.id, texto: `📄 Plan enviado en PDF: ${p.nombre}`, autor: "nutri", canal: "whatsapp" });
            pintarHilo();
          }
        } }, "📲 Enviar PDF"),
        el("button", { class: "btn", onclick: () => { enviarEmail(prev.textContent, "Tu plan nutricional"); m.close(); } }, "✉️ Email"),
        el("button", { class: "btn btn-primary", onclick: () => { enviarWhatsApp(prev.textContent); m.close(); } }, "🟢 WhatsApp"),
      ],
    });
    pintarPrev();
  }

  // --- Layout ---
  const contactoPills = el("div", { class: "row", style: "gap:8px;margin-bottom:4px" }, [
    el("span", { class: "pill" + (telLimpio ? " accent" : "") }, telLimpio ? "📱 " + pac.telefono : "📱 sin teléfono"),
    el("span", { class: "pill" + (pac.email ? " accent" : "") }, pac.email ? "✉️ " + pac.email : "✉️ sin email"),
    el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => NP.app.go("#/paciente/" + pac.id) }, "Editar datos"),
  ]);

  view.appendChild(el("div", { class: "plan-head" }, [
    el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + pac.id) }, "← Volver a " + nombreCorto),
    el("div", { class: "grow" }),
    el("button", { class: "btn", onclick: registrarRespuesta }, "＋ Anotar respuesta"),
  ]));
  view.appendChild(el("div", { class: "panel" }, [
    contactoPills,
    el("div", { class: "small muted" }, "El historial se guarda aquí; el mensaje se envía por WhatsApp o email."),
  ]));
  view.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [hiloWrap]));
  view.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [
    el("div", { class: "small muted", style: "margin-bottom:8px" }, "Atajos:"), atajos,
    el("div", { style: "margin-top:12px" }, [input]),
    el("div", { class: "row", style: "gap:8px;margin-top:10px;justify-content:flex-end" }, [
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-ghost", style: "flex:0 0 auto", onclick: () => guardarNota(input.value) }, "📝 Solo guardar"),
      el("button", { class: "btn", style: "flex:0 0 auto", onclick: () => enviarEmail(input.value) }, "✉️ Email"),
      el("button", { class: "btn btn-primary", style: "flex:0 0 auto", onclick: () => enviarWhatsApp(input.value) }, "🟢 Enviar por WhatsApp"),
    ]),
  ]));
  pintarHilo();
};
