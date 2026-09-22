/* views/documentos.js — PDF que el nutricionista le manda al paciente
   (rutinas de entrenamiento, ideas de recetas, guías...), ordenados por tipo.
   El nutricionista los envía desde la ficha del paciente («📂 Documentos») y
   el paciente los encuentra en su apartado «Mis documentos». */
NP.views = NP.views || {};

NP.DOC_CATS = [
  { key: "entrenamiento", ic: "🏋️", label: "Rutinas de entrenamiento", corto: "Entrenamiento" },
  { key: "recetas", ic: "🥗", label: "Ideas de recetas", corto: "Recetas" },
  { key: "guias", ic: "📘", label: "Guías y consejos", corto: "Guías" },
  { key: "otros", ic: "📄", label: "Otros documentos", corto: "Otros" },
];

NP.views.documentos = (function () {
  const { el, toast, modal, fmt, sinAcentos } = NP.util;
  const MAX_MB = 20;

  const cat = (k) => NP.DOC_CATS.find((c) => c.key === k) || NP.DOC_CATS[NP.DOC_CATS.length - 1];
  const fecha = (ms) => new Date(ms).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  const peso = (b) => (!b ? "" : b < 1048576 ? fmt(Math.max(1, b / 1024)) + " KB" : fmt(b / 1048576, 1) + " MB");
  const meta = (d) => [fecha(d.fecha), peso(d.tamano)].filter(Boolean).join(" · ");
  const esPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  const nombreArchivo = (d) => d.archivo || d.titulo.replace(/[\\/:*?"<>|]+/g, "").trim() + ".pdf";
  /** "rutina_fuerza-3dias.pdf" -> "Rutina fuerza 3dias" */
  function tituloDe(nombre) {
    const t = nombre.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /** Agrupa por categoría en el orden de NP.DOC_CATS, sin grupos vacíos */
  const agrupar = (docs) => NP.DOC_CATS
    .map((c) => ({ c, docs: docs.filter((d) => cat(d.categoria).key === c.key) }))
    .filter((g) => g.docs.length);

  /* Abre el PDF en otra pestaña. La pestaña se abre ANTES de pedir el enlace:
     si se abriera después de esperar a la nube, el navegador la tomaría por
     una ventana emergente y la bloquearía. */
  async function abrir(doc) {
    const w = window.open("", "_blank");
    if (w) {
      try { w.document.write('<p style="font:15px system-ui;padding:24px;color:#666">Abriendo documento…</p>'); }
      catch (e) { /* sin mensaje de espera */ }
    }
    try {
      const url = await NP.store.urlDocumento(doc);
      if (w && !w.closed) w.location.href = url;
      else enlaceManual(doc, url);
      return true;
    } catch (e) {
      if (w) w.close();
      toast("No se pudo abrir el documento: " + e.message);
      return false;
    }
  }
  // Si el navegador bloquea la pestaña nueva, se ofrece el enlace a mano
  function enlaceManual(doc, url) {
    const m = modal({
      title: doc.titulo,
      body: el("div", { class: "small muted" }, "Tu navegador no ha dejado abrir una pestaña nueva. Pulsa el botón para ver el PDF."),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cerrar"),
        el("a", { class: "btn btn-primary", href: url, target: "_blank", rel: "noopener", onclick: () => m.close() }, "📖 Abrir el PDF"),
      ],
    });
  }
  async function descargar(doc) {
    try {
      const url = await NP.store.urlDocumento(doc, { descargar: nombreArchivo(doc) });
      const a = el("a", { href: url, download: nombreArchivo(doc) });
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) {
      toast("No se pudo descargar: " + e.message);
      return false;
    }
  }

  /** Mensaje en el chat para que el paciente se entere de que tiene un documento nuevo */
  function avisarEnChat(doc) {
    NP.store.saveMensaje({
      pacienteId: doc.pacienteId, autor: "nutri", canal: "app",
      texto: `📂 Te he enviado un documento nuevo: «${doc.titulo}» (${cat(doc.categoria).label}).\n` +
        "Lo tienes en «Mis documentos»." + (doc.nota ? "\n\n" + doc.nota : ""),
    });
  }

  /* Casillas para elegir pacientes (enviar el mismo PDF a varios a la vez) */
  function selectorPacientes(lista) {
    const checks = lista.map((p) => {
      const input = el("input", { type: "checkbox", style: "width:auto;margin:0;flex:0 0 auto" });
      return { id: p.id, input, label: el("label", { class: "dia-check" }, [input, el("span", {}, p.nombre)]) };
    });
    const marcar = (v) => checks.forEach((c) => (c.input.checked = v));
    const nodo = el("div", {}, [
      el("div", { class: "row", style: "gap:6px;margin-bottom:8px" }, [
        el("button", { class: "btn btn-sm", type: "button", style: "flex:0 0 auto", onclick: () => marcar(true) }, "Todos"),
        el("button", { class: "btn btn-sm btn-ghost", type: "button", style: "flex:0 0 auto", onclick: () => marcar(false) }, "Ninguno"),
      ]),
      el("div", { class: "dias-pick pac-pick" }, checks.map((c) => c.label)),
    ]);
    return { nodo, elegidos: () => checks.filter((c) => c.input.checked).map((c) => c.id) };
  }
  const casillaAvisar = () => {
    const input = el("input", { type: "checkbox", checked: true, style: "width:auto;margin:0;flex:0 0 auto" });
    return { input, nodo: el("label", { class: "row", style: "gap:8px;align-items:center;margin-top:14px;cursor:pointer" }, [
      input, el("span", { class: "small muted" }, "Avisar también por el chat de la app"),
    ]) };
  };

  /* ================= Enviar un PDF nuevo (nutricionista) ================= */
  function formSubir(pac, onHecho) {
    let archivo = null;
    let categoria = "entrenamiento";

    const fFile = el("input", { type: "file", accept: "application/pdf,.pdf" });
    const dropTx = el("div", {}, "Pulsa para elegir el PDF o arrástralo aquí");
    const dropSub = el("div", { class: "small muted" }, "Solo PDF · máximo " + MAX_MB + " MB");
    const drop = el("label", { class: "doc-drop" }, [el("div", { class: "big" }, "📄"), dropTx, dropSub, fFile]);
    const fTit = el("input", { placeholder: "Ej.: Rutina de fuerza · 3 días" });
    const fNota = el("textarea", { rows: 2, placeholder: "Opcional: indicaciones para el paciente (p. ej. «hazla lunes, miércoles y viernes»)" });
    const err = el("div", { class: "auth-error", hidden: true });

    function elegir(f) {
      if (!f) return;
      if (!esPdf(f)) { mostrarError("Solo se pueden enviar archivos PDF."); return; }
      if (f.size > MAX_MB * 1048576) { mostrarError(`Ese PDF pesa ${peso(f.size)}; el máximo son ${MAX_MB} MB.`); return; }
      err.hidden = true;
      archivo = f;
      drop.classList.add("lleno");
      dropTx.textContent = "✓ " + f.name;
      dropSub.textContent = peso(f.size) + " · pulsa para cambiarlo";
      if (!fTit.value.trim()) fTit.value = tituloDe(f.name);
    }
    fFile.addEventListener("change", () => elegir(fFile.files[0]));
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("encima"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("encima"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("encima");
      elegir(e.dataTransfer.files[0]);
    });
    function mostrarError(t) { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: "nearest" }); }

    const cats = el("div", { class: "dias-pick" }, NP.DOC_CATS.map((c) => {
      const r = el("input", { type: "radio", name: "doc-cat", value: c.key, style: "width:auto;margin:0;flex:0 0 auto",
        ...(c.key === categoria ? { checked: true } : {}) });
      r.addEventListener("change", () => { categoria = c.key; });
      return el("label", { class: "dia-check" }, [r, el("span", {}, c.ic + " " + c.corto)]);
    }));

    const otros = NP.store.getPacientes().filter((x) => x.id !== pac.id);
    const selector = otros.length ? selectorPacientes(otros) : null;
    const avisar = casillaAvisar();
    const corto = pac.nombre.split(" ")[0];

    const btnEnviar = el("button", { class: "btn btn-primary", onclick: enviar }, "Enviar a " + corto);
    const m = modal({
      title: "📂 Enviar un PDF a " + corto, wide: true,
      body: el("div", {}, [
        drop,
        el("label", { class: "field" }, [el("span", {}, "Título que verá el paciente"), fTit]),
        el("div", { class: "field" }, [el("span", { class: "small muted", style: "display:block;margin-bottom:5px" }, "Tipo de documento"), cats]),
        el("label", { class: "field" }, [el("span", {}, "Nota para el paciente"), fNota]),
        selector ? el("div", { class: "field" }, [
          el("span", { class: "small muted", style: "display:block;margin-bottom:5px" },
            "¿Se lo mandas también a otros pacientes? (se sube una sola vez)"),
          selector.nodo,
        ]) : null,
        avisar.nodo,
        err,
      ]),
      footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"), btnEnviar],
    });

    async function enviar() {
      if (!archivo) { mostrarError("Elige el PDF que quieres enviar."); return; }
      const titulo = fTit.value.trim() || tituloDe(archivo.name);
      const ids = [pac.id].concat(selector ? selector.elegidos() : []);
      err.hidden = true;
      btnEnviar.disabled = true; btnEnviar.textContent = "Subiendo...";
      try {
        const docs = await NP.store.subirDocumento(archivo, { titulo, categoria, nota: fNota.value.trim() }, ids);
        if (avisar.input.checked) docs.forEach(avisarEnChat);
        m.close();
        toast(ids.length > 1 ? `Enviado a ${ids.length} pacientes ✓` : "Documento enviado ✓");
        onHecho && onHecho();
      } catch (e) {
        btnEnviar.disabled = false; btnEnviar.textContent = "Enviar a " + corto;
        mostrarError(e.message);
      }
    }
  }

  /* ============ Mandar a más pacientes un PDF ya enviado ============ */
  function compartir(doc, onHecho) {
    const yaLoTienen = new Set(NP.store.getDocumentos().filter((d) => d.ruta === doc.ruta).map((d) => d.pacienteId));
    const otros = NP.store.getPacientes().filter((p) => !yaLoTienen.has(p.id));
    if (!otros.length) { toast("Todos tus pacientes tienen ya este documento"); return; }
    const selector = selectorPacientes(otros);
    const avisar = casillaAvisar();
    const btn = el("button", { class: "btn btn-primary", onclick: async () => {
      const ids = selector.elegidos();
      if (!ids.length) { toast("Marca al menos un paciente"); return; }
      btn.disabled = true; btn.textContent = "Enviando...";
      try {
        const docs = await NP.store.compartirDocumento(doc.id, ids);
        if (avisar.input.checked) docs.forEach(avisarEnChat);
        m.close(); toast(`Enviado a ${ids.length} paciente(s) ✓`);
        onHecho && onHecho();
      } catch (e) {
        btn.disabled = false; btn.textContent = "Enviar";
        toast("No se pudo enviar: " + e.message);
      }
    } }, "Enviar");
    const m = modal({
      title: "↗ Enviar «" + doc.titulo + "» a más pacientes",
      body: el("div", {}, [
        el("div", { class: "small muted", style: "margin-bottom:10px" }, "Les aparecerá en «Mis documentos», en " + cat(doc.categoria).label.toLowerCase() + "."),
        selector.nodo, avisar.nodo,
      ]),
      footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"), btn],
    });
  }

  function avisoBaseDeDatos() {
    return el("div", { class: "auth-error", style: "margin-bottom:14px" },
      "Los documentos todavía no están activados en la base de datos. Abre Supabase → SQL Editor, " +
      "pega el archivo supabase/esquema.sql entero y pulsa «Run». Después recarga la app.");
  }

  /* ================= Documentos de un paciente (nutricionista) ================= */
  function nutri(view, pacienteId) {
    const pac = NP.store.getPaciente(pacienteId);
    if (!pac) { NP.app.go("#/pacientes"); return; }
    const corto = pac.nombre.split(" ")[0];
    NP.app.setTitle("Documentos · " + pac.nombre);
    const recargar = () => NP.app.route();

    view.appendChild(el("div", { class: "plan-head" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + pac.id) }, "← Volver a " + corto),
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-primary", onclick: () => formSubir(pac, recargar) }, "＋ Enviar PDF"),
    ]));
    if (!NP.store.docsListos()) view.appendChild(avisoBaseDeDatos());
    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "small muted" },
        "Rutinas de entrenamiento, ideas de recetas, guías... " + corto + " los ve ordenados por tipo en su apartado " +
        "«Mis documentos» y puede abrirlos o descargarlos desde el móvil." +
        (NP.auth.cuentaDePaciente(pac.id) ? "" : " Todavía no tiene cuenta: los verá en cuanto la cree con su código de acceso.")),
    ]));

    const docs = NP.store.documentosDe(pac.id);
    if (!docs.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📂"),
        el("div", {}, "Aún no le has enviado ningún documento."),
        el("button", { class: "btn", style: "margin-top:16px", onclick: () => formSubir(pac, recargar) }, "＋ Enviar el primero"),
      ]));
      return;
    }

    agrupar(docs).forEach((g) => {
      view.appendChild(cabeceraGrupo(g));
      view.appendChild(el("div", { class: "list" }, g.docs.map((d) =>
        el("div", { class: "list-item" }, [
          el("div", { class: "avatar" }, g.c.ic),
          el("div", { class: "grow", onclick: () => abrir(d) }, [
            el("div", { class: "name" }, d.titulo),
            el("div", { class: "small muted" }, meta(d)),
            d.nota ? el("div", { class: "small muted doc-nota-1", title: d.nota }, "📝 " + d.nota) : null,
          ]),
          d.visto
            ? el("span", { class: "pill accent", title: "El paciente ya lo ha abierto" }, "👁 Visto")
            : el("span", { class: "pill", title: "El paciente todavía no lo ha abierto" }, "Sin abrir"),
          el("button", { class: "btn btn-sm", onclick: () => abrir(d) }, "Abrir"),
          el("button", { class: "btn btn-sm", title: "Mandar este mismo PDF a otros pacientes",
            onclick: () => compartir(d, recargar) }, "↗ A otros"),
          el("button", { class: "btn btn-sm btn-danger", title: "Quitárselo al paciente", onclick: () => {
            if (!confirm(`¿Quitarle «${d.titulo}» a ${corto}? Dejará de verlo.`)) return;
            NP.store.deleteDocumento(d.id); toast("Documento quitado"); recargar();
          } }, "🗑"),
        ]))));
    });
  }

  function cabeceraGrupo(g) {
    return el("div", { class: "doc-sec" }, [
      el("span", { class: "doc-sec-ic" }, g.c.ic),
      el("span", {}, g.c.label),
      el("span", { class: "tag" }, String(g.docs.length)),
    ]);
  }

  /* ================= Mis documentos (paciente) ================= */
  function cliente(view) {
    const p = NP.auth.pacienteActual();
    if (!p) return;
    NP.app.setTitle("Mis documentos");
    const nutriNombre = (() => {
      const u = p.nutriId ? NP.auth.getUsuario(p.nutriId) : null;
      return u ? u.nombre : "tu nutricionista";
    })();

    const todos = NP.store.documentosDe(p.id);
    if (!todos.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📂"),
        el("div", {}, "Todavía no tienes documentos."),
        el("div", { class: "small muted", style: "margin-top:6px;max-width:420px;margin-left:auto;margin-right:auto" },
          "Aquí aparecerán las rutinas de entrenamiento, ideas de recetas y demás PDF que te mande " + nutriNombre + "."),
      ]));
      return;
    }

    let filtro = "todos";
    let busqueda = "";
    const grupos = agrupar(todos);
    const seg = grupos.length > 1 ? el("div", { class: "seg seg-docs" }, [
      el("button", { class: "active", onclick: (e) => setFiltro("todos", e.currentTarget) }, "Todos"),
      ...grupos.map((g) => el("button", { onclick: (e) => setFiltro(g.c.key, e.currentTarget) },
        g.c.ic + " " + g.c.corto + " (" + g.docs.length + ")")),
    ]) : null;
    function setFiltro(k, btn) {
      filtro = k;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pintar();
    }
    const buscar = todos.length > 5 ? el("input", { type: "search", placeholder: "Buscar un documento...", style: "max-width:260px" }) : null;
    if (buscar) buscar.addEventListener("input", NP.util.debounce(() => { busqueda = buscar.value; pintar(); }));

    const nuevos = todos.filter((d) => !d.visto).length;
    view.appendChild(el("div", { class: "toolbar" }, [
      el("div", { class: "grow small muted" },
        todos.length + " documento(s) de " + nutriNombre + (nuevos ? " · " + nuevos + " nuevo(s)" : "")),
      buscar,
      seg,
    ]));
    const cuerpo = el("div", {});
    view.appendChild(cuerpo);

    function pintar() {
      cuerpo.innerHTML = "";
      const q = sinAcentos(busqueda.trim());
      const lista = NP.store.documentosDe(p.id).filter((d) =>
        (filtro === "todos" || cat(d.categoria).key === filtro) &&
        (!q || sinAcentos(d.titulo + " " + (d.nota || "")).indexOf(q) >= 0));
      if (!lista.length) {
        cuerpo.appendChild(el("div", { class: "empty" }, [el("div", {}, "Ningún documento coincide con la búsqueda.")]));
        return;
      }
      agrupar(lista).forEach((g) => {
        cuerpo.appendChild(cabeceraGrupo(g));
        cuerpo.appendChild(el("div", { class: "doc-grid" }, g.docs.map(tarjeta)));
      });
    }

    function tarjeta(d) {
      const c = cat(d.categoria);
      const visto = () => {
        if (d.visto) return;
        NP.store.marcarDocumentoVisto(d.id);
        NP.app.refrescarNav();
        pintar();
      };
      const verlo = async () => { if (await abrir(d)) visto(); };
      return el("div", { class: "doc-card" + (d.visto ? "" : " es-nuevo") }, [
        el("div", { class: "doc-top", onclick: verlo }, [
          el("div", { class: "doc-ic" }, c.ic),
          el("div", { class: "grow" }, [
            el("div", { class: "doc-tit" }, d.titulo),
            el("div", { class: "small muted" }, meta(d)),
          ]),
          d.visto ? null : el("span", { class: "doc-nuevo" }, "Nuevo"),
        ]),
        d.nota ? el("div", { class: "doc-nota" }, d.nota) : null,
        el("div", { class: "doc-acc" }, [
          el("button", { class: "btn btn-primary btn-sm", onclick: verlo }, "📖 Abrir"),
          el("button", { class: "btn btn-sm", onclick: async () => { if (await descargar(d)) visto(); } }, "⬇️ Descargar"),
        ]),
      ]);
    }

    pintar();
  }

  return { nutri, cliente, formSubir };
})();
