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
  return { id: NP.util.uid(), titulo: "", items: [], alimentos: [], preparacion: "" };
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
  const { el, modal, toast, fmt } = NP.util;
  const CM = NP.calcMenu;
  const MAC = [["kcal", "kcal", ""], ["p", "P", " g"], ["g", "G", " g"], ["h", "H", " g"]];
  /** «520 kcal · P 32 · G 14 · H 60» */
  const textoMacros = (n) => fmt(n.kcal) + " kcal · P " + fmt(n.p) + " · G " + fmt(n.g) + " · H " + fmt(n.h);

  /** Fichas de kcal y macros frente al objetivo, en verde / ámbar / rojo según el margen */
  function fichasMedidor(n, objetivo, margen) {
    return el("div", { class: "med-fichas" }, MAC.map(([k, lb, u]) => {
      const e = objetivo ? CM.estado(n[k], objetivo[k], k, margen) : { cls: "" };
      const dif = objetivo && objetivo[k] > 0 ? Math.round(n[k] - objetivo[k]) : null;
      return el("span", {
        class: "med-ficha " + e.cls,
        title: objetivo ? `Objetivo ${fmt(objetivo[k])}${u} · margen ±${fmt(e.tol || 0)}${u}` : "",
      }, [
        el("b", {}, (k === "kcal" ? "" : lb + " ") + fmt(n[k]) + (k === "kcal" ? " kcal" : "")),
        objetivo && objetivo[k] > 0 ? el("span", { class: "med-obj" }, "/ " + fmt(objetivo[k]) +
          (dif ? " (" + (dif > 0 ? "+" : "") + fmt(dif) + ")" : "")) : null,
      ]);
    }));
  }

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

    // Kcal y macros de cada opción, salvo que el nutricionista prefiera no enseñarlos
    const verMacros = !plan.objetivos || plan.objetivos.verPaciente !== false;
    function tarjetaOpcion(op, i) {
      const n = verMacros && (op.alimentos || []).length ? CM.calcularOpcion(op, plan.enlaces || {}).n : null;
      return el("div", { class: "op-card" }, [
        el("div", { class: "op-num" }, "Opción " + (i + 1)),
        el("div", { class: "op-tit" }, op.titulo || "—"),
        n && n.kcal > 0 ? el("div", { class: "op-macros" }, "≈ " + textoMacros(n)) : null,
        el("ul", { class: "op-lista" }, (op.alimentos || []).map((a) => el("li", {}, a))),
        op.preparacion ? el("div", { class: "op-prep" }, [el("b", {}, "Preparación: "), op.preparacion]) : null,
      ]);
    }

    pintar();
  }

  /* ================= Editor (nutricionista) =================
     Se trabaja UN TIPO DE DÍA cada vez (pestañas: entreno, descanso...) y en tres pasos:
       ① Objetivo del día: las kcal y el % que va a cada macro.
       ② Reparto entre comidas: lo que lleva cada comida (automático o escrito a mano).
       ③ Opciones de cada comida: los alimentos, y un aviso en palabras de si cuadran. */
  const KCAL_G = { p: 4, g: 9, h: 4 };
  const MACROS = [["p", "Proteína"], ["g", "Grasa"], ["h", "Hidratos"]];
  const NOMBRE_MAC = { kcal: "kcal", p: "proteína", g: "grasa", h: "hidratos" };
  const num = (v) => { const n = Number(String(v).replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

  /** Enteros que suman exactamente 100 (lo que falta por redondeo va a los decimales mayores) */
  function a100(v) {
    const tot = MACROS.reduce((s, [k]) => s + v[k], 0) || 1;
    const esc = MACROS.map(([k]) => ({ k, v: (v[k] * 100) / tot }));
    const res = {};
    let suma = 0;
    esc.forEach((x) => { res[x.k] = Math.floor(x.v); suma += res[x.k]; });
    esc.sort((a, b) => (b.v % 1) - (a.v % 1)).slice(0, 100 - suma).forEach((x) => res[x.k]++);
    return res;
  }
  const pctDe = (o) => (o.p || o.g || o.h) ? a100({ p: o.p * 4, g: o.g * 9, h: o.h * 4 }) : { p: 25, g: 30, h: 45 };
  const kcalDe = (o) => Math.round(o.p * 4 + o.g * 9 + o.h * 4);

  /** Qué falla frente a un objetivo, dicho en palabras: {cls: "ok"|"cerca"|"fuera"|"", texto} */
  function veredicto(n, objetivo, margen, frases) {
    const fr = Object.assign({ ok: "✓ Cuadra", falta: "Faltan ", sobra: "Sobran " }, frases);
    if (!objetivo || !(objetivo.kcal > 0)) return { cls: "", texto: "" };
    const malos = MAC.map(([k]) => ({ k, e: CM.estado(n[k], objetivo[k], k, margen) }))
      .filter((x) => x.e.cls === "cerca" || x.e.cls === "fuera")
      // Primero las kcal, que es lo que más importa; después, el macro que más se desvía
      .sort((a, b) => (b.k === "kcal") - (a.k === "kcal") || Math.abs(b.e.dif) / b.e.tol - Math.abs(a.e.dif) / a.e.tol);
    if (!malos.length) return { cls: "ok", texto: fr.ok };
    const unidad = (k) => (k === "kcal" ? " kcal" : " g de " + NOMBRE_MAC[k]);
    return {
      cls: malos.some((x) => x.e.cls === "fuera") ? "fuera" : "cerca",
      texto: malos.slice(0, 2).map((x) => (x.e.dif > 0 ? fr.sobra : fr.falta) + fmt(Math.abs(x.e.dif)) + unidad(x.k)).join(" · "),
    };
  }
  const PEOR = { "": 0, ok: 1, cerca: 2, fuera: 3 };

  /** Menú «⋯» con acciones poco usadas, para no llenar la pantalla de botones */
  function menuAcciones(items, titulo) {
    const d = el("details", { class: "acc" });
    d.appendChild(el("summary", { class: "acc-btn", title: titulo || "Más acciones" }, "⋯"));
    d.appendChild(el("div", { class: "acc-lista" }, items.filter(Boolean).map(([tx, fn, peligro]) =>
      el("button", { class: peligro ? "peligro" : "", onclick: () => { d.removeAttribute("open"); fn(); } }, tx))));
    return d;
  }
  // Un menú «⋯» abierto se cierra al pulsar fuera de él
  document.addEventListener("click", (e) => {
    document.querySelectorAll("details.acc[open]").forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });

  const iconoDia = (nom) => {
    const n = NP.util.sinAcentos(nom);
    if (n.includes("entren")) return "💪";
    if (n.includes("descans")) return "😴";
    if (n.includes("fin de semana")) return "🎉";
    return "📅";
  };
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

  function editor(view, planId) {
    const plan = NP.store.getPlan(planId);
    if (!plan || !NP.esMenu(plan)) { NP.app.go("#/pacientes"); return; }
    const pac = NP.store.getPaciente(plan.pacienteId);
    NP.app.setTitle(plan.nombre + (pac ? " · " + pac.nombre : ""));
    const guardar = () => NP.store.savePlan(plan);
    plan.bloques = plan.bloques || [];
    plan.suplementos = plan.suplementos || [];
    plan.enlaces = plan.enlaces || {};

    // Ajustes de todo el menú (margen, reparto automático, qué ve el paciente).
    // El objetivo del día va en cada tipo de día: el de entreno y el de descanso pueden ser distintos.
    let cambiado = false;
    if (!plan.objetivos) {
      plan.objetivos = Object.assign(CM.objetivosDeFicha(pac), { margen: 15, reparto: "tipo", verPaciente: true });
      cambiado = true;
    }
    const aj = plan.objetivos;
    const copiaObjetivo = (o) => ({ kcal: o.kcal, p: o.p, g: o.g, h: o.h, pct: o.pct ? Object.assign({}, o.pct) : pctDe(o) });
    plan.bloques.forEach((b) => { if (!b.objetivos) { b.objetivos = copiaObjetivo(aj); cambiado = true; } });
    if (cambiado) guardar();

    const objetivosComidas = (b) => CM.objetivosComidas(b, Object.assign({}, b.objetivos, { reparto: aj.reparto }));

    // Tipo de día que se está editando (se recuerda al volver al menú)
    const CLAVE_DIA = "np_menu_dia_" + plan.id;
    let activoId = null;
    try { activoId = localStorage.getItem(CLAVE_DIA); } catch (e) { /* sin almacenamiento */ }
    const activo = () => plan.bloques.find((b) => b.id === activoId) || plan.bloques[0] || null;
    function elegirDia(b) {
      activoId = b.id;
      try { localStorage.setItem(CLAVE_DIA, b.id); } catch (e) { /* sin almacenamiento */ }
      pintar();
    }
    const plegadas = new Set();        // comidas plegadas
    const conTexto = new Set();        // comidas con el «texto suelto» a la vista
    const conPrep = new Set();         // opciones con la preparación a la vista

    // Trozos que se actualizan solos al cambiar cualquier cosa. Así no se repinta todo
    // y no se pierde lo que se está escribiendo.
    let vivos = [];
    function vivo(tag, attrs, fn) {
      const n = el(tag, attrs);
      const r = () => { n.innerHTML = ""; fn(n); };
      r();
      vivos.push(r);
      return n;
    }
    const refrescar = () => vivos.forEach((f) => f());

    /** Opciones con alimentos de una comida frente a lo que lleva: {total, ok, cls} */
    function estadoComida(c, oc) {
      const ops = (c.opciones || []).filter((o) => (o.alimentos || []).length);
      let ok = 0, cls = "";
      ops.forEach((o) => {
        const v = veredicto(CM.calcularOpcion(o, plan.enlaces).n, oc, aj.margen);
        if (v.cls === "ok") ok++;
        if (PEOR[v.cls] > PEOR[cls]) cls = v.cls;
      });
      return { total: ops.length, ok, cls };
    }
    function estadoDia(b) {
      const objs = objetivosComidas(b);
      let cls = "";
      (b.comidas || []).forEach((c) => { const e = estadoComida(c, objs[c.id]); if (PEOR[e.cls] > PEOR[cls]) cls = e.cls; });
      return cls;
    }

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

    const cuerpo = el("div", { class: "mnu" });
    view.appendChild(cuerpo);

    /** Campo que guarda solo al salir, para no repintar mientras se escribe */
    function campo(attrs, onSet, multi) {
      const n = el(multi ? "textarea" : "input", attrs, multi ? [attrs.value || ""] : []);
      if (multi) n.removeAttribute("value");
      n.addEventListener("change", () => { onSet(n.value); guardar(); });
      return n;
    }

    function pintar() {
      const y = window.scrollY;
      vivos = [];
      cuerpo.innerHTML = "";
      if (modo === "vista") { vista(cuerpo, plan); return; }
      cuerpo.appendChild(cabeceraMenu());
      const barra = barraDias();
      cuerpo.appendChild(barra);
      const tabAct = barra.querySelector(".dia-tab.activo");
      if (tabAct) tabAct.parentNode.scrollLeft = Math.max(0, tabAct.offsetLeft - tabAct.parentNode.offsetLeft - 8);
      const b = activo();
      if (b) {
        cuerpo.appendChild(pasoObjetivo(b));
        cuerpo.appendChild(pasoReparto(b));
        cuerpo.appendChild(pasoComidas(b));
      } else {
        cuerpo.appendChild(el("div", { class: "empty" }, [
          el("div", { class: "big" }, "📅"),
          el("div", {}, "Añade un tipo de día (por ejemplo «Días de entrenamiento») para empezar."),
          el("button", { class: "btn btn-primary", style: "margin-top:14px", onclick: nuevoDia }, "＋ Añadir tipo de día"),
        ]));
      }
      cuerpo.appendChild(seccionSuplementos());
      window.scrollTo(0, y);
    }

    /** Recuadro de un paso: número, título con el tipo de día y el contenido */
    function paso(n, titulo, sub, b, acciones, hijos) {
      return el("section", { class: "paso" }, [
        el("div", { class: "paso-cab" }, [
          el("span", { class: "paso-n" }, String(n)),
          el("div", { class: "paso-tit" }, [
            el("h3", {}, [titulo, b ? el("span", { class: "paso-dia" }, " · " + iconoDia(b.nombre) + " " + b.nombre) : null]),
            sub ? el("div", { class: "small muted" }, sub) : null,
          ]),
          acciones ? el("div", { class: "paso-acc" }, acciones) : null,
        ]),
        el("div", { class: "paso-cuerpo" }, hijos),
      ]);
    }

    /* ---------- Cabecera: nombre del menú y lo que es de todo el menú ---------- */
    function cabeceraMenu() {
      const fVer = el("input", { type: "checkbox", ...(aj.verPaciente !== false ? { checked: true } : {}) });
      fVer.addEventListener("change", () => { aj.verPaciente = fVer.checked; guardar(); });
      return el("div", { class: "panel mnu-cab" }, [
        el("div", { class: "mnu-cab-fila" }, [
          el("span", { class: "menu-hero-ico" }, "🥗"),
          el("div", { class: "grow" }, [
            campo({ value: plan.nombre, class: "mnu-nombre", "aria-label": "Nombre del menú", placeholder: "Nombre del menú" },
              (v) => { plan.nombre = v.trim() || "Menú"; NP.app.setTitle(plan.nombre); }),
            el("div", { class: "small muted" }, (pac ? "Para " + pac.nombre + " · " : "") +
              plan.bloques.length + (plan.bloques.length === 1 ? " tipo de día" : " tipos de día")),
          ]),
        ]),
        el("details", { class: "mnu-nota", ...(plan.nota ? { open: true } : {}) }, [
          el("summary", {}, "📝 Nota para el paciente" + (plan.nota ? "" : " (opcional)")),
          campo({ rows: 2, value: plan.nota || "", placeholder: "Cómo usar el menú, agua al día, recordatorios..." },
            (v) => { plan.nota = v.trim(); }, true),
        ]),
        el("label", { class: "mnu-check" }, [fVer, "Enseñar al paciente las kcal y los macros de cada opción"]),
      ]);
    }

    /* ---------- Pestañas de tipo de día (fijas arriba al bajar por la página) ---------- */
    function barraDias() {
      const b0 = activo();
      const leyenda = { ok: "Todas las opciones cuadran", cerca: "Alguna opción se sale un poco", fuera: "Alguna opción se sale bastante", "": "Sin opciones escritas" };
      return el("div", { class: "dias-barra" }, [
        el("span", { class: "dias-lb" }, "Tipo de día"),
        el("div", { class: "dias-tabs" }, plan.bloques.map((b) => el("button", {
          class: "dia-tab" + (b === b0 ? " activo" : ""), onclick: () => elegirDia(b),
        }, [
          el("span", {}, iconoDia(b.nombre) + " " + b.nombre),
          vivo("span", {}, (n) => { const cls = estadoDia(b); n.className = "dia-punto " + cls; n.title = leyenda[cls]; }),
        ]))),
        el("button", { class: "btn btn-sm", style: "flex:0 0 auto", title: "Añadir un tipo de día", onclick: nuevoDia },
          ["＋", el("span", { class: "dia-mas-tx" }, " Tipo de día")]),
        b0 ? menuAcciones([
          ["✏️ Cambiar el nombre de «" + b0.nombre + "»", () => elegirNombre("Cambiar el nombre", NP.BLOQUES_MENU, (nom) => {
            b0.nombre = nom; guardar(); pintar();
          }, b0.nombre, "Guardar")],
          plan.bloques.length > 1 ? ["⧉ Copiar sus comidas en otro tipo de día", () => copiarBloque(b0)] : null,
          ["🗑 Quitar este tipo de día", () => {
            if (!confirm("¿Quitar «" + b0.nombre + "» con todas sus comidas y opciones?")) return;
            plan.bloques.splice(plan.bloques.indexOf(b0), 1); guardar(); pintar();
          }, true],
        ], "Acciones de este tipo de día") : null,
      ]);
    }

    /** Nuevo tipo de día: con las mismas comidas (vacías) y el mismo objetivo que el que se está viendo */
    function nuevoDia() {
      const base = activo();
      elegirNombre("Nuevo tipo de día", NP.BLOQUES_MENU, (nom) => {
        const b = {
          id: NP.util.uid(), nombre: nom, nota: "",
          objetivos: copiaObjetivo(base ? base.objetivos : aj),
          comidas: (base ? base.comidas || [] : []).map((c) => ({ id: NP.util.uid(), nombre: c.nombre, texto: "", opciones: [nuevaOpcion()] })),
        };
        plan.bloques.push(b);
        guardar(); elegirDia(b);
        toast(base ? "Creado con las mismas comidas que «" + base.nombre + "», vacías" : "Tipo de día creado ✓");
      });
    }

    /* ---------- ① Objetivo del día ---------- */
    function pasoObjetivo(b) {
      const o = b.objetivos;
      if (!o.pct) o.pct = pctDe(o);
      const hecho = () => { guardar(); refrescar(); };
      const gramosDePct = () => MACROS.forEach(([k]) => { o[k] = Math.round((o.kcal * o.pct[k]) / 100 / KCAL_G[k]); });

      const fKcal = el("input", { type: "number", min: 0, step: 50, class: "obj-kcal", "aria-label": "Kcal al día" });
      fKcal.addEventListener("change", () => { o.kcal = Math.round(num(fKcal.value)); gramosDePct(); pintarValores(); hecho(); });

      const barra = el("div", { class: "macrobar obj-reparto" });
      const filas = {};
      let base = null; // reparto al empezar a arrastrar: las otras dos barras se reparten en esa proporción
      function moverBarra(k, v) {
        const bs = base || o.pct;
        const [o1, o2] = MACROS.map(([x]) => x).filter((x) => x !== k);
        v = Math.max(0, Math.min(100, Math.round(v)));
        const resto = 100 - v;
        const suma = bs[o1] + bs[o2];
        const x1 = suma > 0 ? Math.round((resto * bs[o1]) / suma) : Math.round(resto / 2);
        o.pct = { [k]: v, [o1]: x1, [o2]: resto - x1 };
        gramosDePct();
        pintarValores();
      }
      MACROS.forEach(([k, lb]) => {
        const rango = el("input", { type: "range", min: 0, max: 100, step: 1, class: "obj-rango rango-" + k,
          "aria-label": "% de las kcal para " + lb.toLowerCase() });
        const empezar = () => { base = Object.assign({}, o.pct); };
        ["pointerdown", "touchstart", "keydown", "focus"].forEach((ev) => rango.addEventListener(ev, empezar));
        rango.addEventListener("input", () => moverBarra(k, Number(rango.value)));
        rango.addEventListener("change", () => { base = null; hecho(); });
        // Los gramos también se escriben a mano: cambian las kcal del día y los %
        const gr = el("input", { type: "number", min: 0, step: 1, class: "obj-gr-inp", "aria-label": lb + " en gramos" });
        gr.addEventListener("change", () => { o[k] = Math.round(num(gr.value)); o.kcal = kcalDe(o); o.pct = pctDe(o); pintarValores(); hecho(); });
        filas[k] = { rango, gr, pct: el("b", { class: "obj-pct" }), extra: el("span", { class: "obj-gkg" }) };
      });
      function pintarValores() {
        barra.innerHTML = "";
        MACROS.forEach(([k]) => barra.appendChild(el("span", { class: "mb-" + k, style: "width:" + o.pct[k] + "%" })));
        if (document.activeElement !== fKcal) fKcal.value = o.kcal;
        MACROS.forEach(([k]) => {
          const fl = filas[k];
          fl.rango.value = o.pct[k];
          fl.pct.textContent = o.pct[k] + " %";
          if (document.activeElement !== fl.gr) fl.gr.value = o[k];
          fl.extra.textContent = pac && pac.peso_kg ? fmt(o[k] / pac.peso_kg, 1) + " g/kg" : "";
        });
      }
      const fMargen = el("select", {}, [5, 10, 15, 20, 25].map((m) =>
        el("option", { value: m, ...(Number(aj.margen) === m ? { selected: true } : {}) }, "± " + m + " %")));
      fMargen.addEventListener("change", () => { aj.margen = Number(fMargen.value); hecho(); });
      pintarValores();

      return paso(1, "Objetivo del día", "Lo que debe sumar un día de este tipo.", b,
        pac ? [el("button", { class: "btn btn-sm", title: "Kcal objetivo de la ficha y reparto de macros según su peso y objetivo", onclick: () => {
          Object.assign(o, CM.objetivosDeFicha(pac));
          o.pct = pctDe(o);
          pintarValores(); hecho(); toast("Objetivo de la ficha de " + pac.nombre.split(" ")[0] + " ✓");
        } }, "↻ Desde la ficha")] : null,
        [
          el("div", { class: "obj-top" }, [
            el("label", { class: "obj-kcal-lb" }, [el("span", {}, "Kcal al día"), fKcal]),
            el("label", { class: "field obj-margen" }, [el("span", {}, "Margen de error (todo el menú)"), fMargen]),
          ]),
          el("div", { class: "obj-macros" }, [
            el("div", { class: "small muted", style: "margin-bottom:8px" },
              "Arrastra una barra para cambiar el % de las kcal: las otras dos se ajustan para sumar 100 % y los gramos cambian solos. También puedes escribir los gramos."),
            barra,
            ...MACROS.map(([k, lb]) => el("div", { class: "obj-fila" }, [
              el("span", { class: "obj-lb" }, [el("span", { class: "dot dot-" + k }), lb]),
              filas[k].rango, filas[k].pct,
              el("span", { class: "obj-gr-caja" }, [filas[k].gr, el("span", { class: "small muted" }, "g")]),
              filas[k].extra,
            ])),
          ]),
        ]);
    }

    /* ---------- ② Reparto entre comidas: tabla editable ---------- */
    function irAComida(c) {
      if (plegadas.delete(c.id)) pintar();
      const n = document.getElementById("mc-" + c.id);
      if (n) window.scrollTo({ top: n.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
    }

    /** Se escribe una celda: kcal escala los macros de esa comida; un macro recalcula sus kcal */
    function fijarCelda(b, c, oc, k, v) {
      const o = { kcal: Math.round(oc.kcal), p: Math.round(oc.p), g: Math.round(oc.g), h: Math.round(oc.h) };
      if (k === "kcal") {
        const pct = (o.p || o.g || o.h) ? pctDe(o) : b.objetivos.pct;
        o.kcal = Math.round(v);
        MACROS.forEach(([m]) => { o[m] = Math.round((o.kcal * pct[m]) / 100 / KCAL_G[m]); });
      } else {
        o[k] = Math.round(v);
        o.kcal = kcalDe(o);
      }
      c.objetivo = o;
      guardar();
      setTimeout(refrescar, 0); // después de que el foco pase a la siguiente casilla
    }

    function pasoReparto(b) {
      const fModo = el("select", { class: "rep-modo", title: "Cómo se reparte lo que no escribes a mano" },
        [["tipo", "Automático: según la comida"], ["igual", "Automático: a partes iguales"]].map(([v, l]) =>
          el("option", { value: v, ...(aj.reparto === v ? { selected: true } : {}) }, l)));
      fModo.addEventListener("change", () => { aj.reparto = fModo.value; guardar(); refrescar(); });

      const tabla = vivo("div", { class: "rep" }, (caja) => {
        const act = document.activeElement;
        const foco = act && act.getAttribute && act.getAttribute("data-foco");
        const comidas = b.comidas || [];
        if (!comidas.length) {
          caja.appendChild(el("div", { class: "small muted" }, "Todavía no hay comidas en este tipo de día. Añádelas en el paso 3."));
          return;
        }
        const objs = objetivosComidas(b);
        const dia = b.objetivos;
        const suma = { kcal: 0, p: 0, g: 0, h: 0 };
        const filas = comidas.map((c) => {
          const oc = objs[c.id];
          MAC.forEach(([k]) => { suma[k] += oc[k]; });
          const celda = (k) => {
            const i = el("input", { type: "number", min: 0, step: k === "kcal" ? 10 : 1, value: Math.round(oc[k]),
              "data-foco": c.id + ":" + k, "aria-label": NOMBRE_MAC[k] + " de " + c.nombre });
            i.addEventListener("change", () => fijarCelda(b, c, oc, k, num(i.value)));
            return el("td", {}, i);
          };
          const e = estadoComida(c, oc);
          return el("tr", { class: c.objetivo ? "manual" : "auto" }, [
            el("th", {}, el("div", { class: "rep-com" }, [
              el("button", { class: "rep-nom", title: "Ir a sus opciones", onclick: () => irAComida(c) }, iconoComida(c.nombre) + " " + c.nombre),
              c.objetivo
                ? el("button", { class: "rep-tag manual", title: "Escrita a mano · pulsa para volver al reparto automático", onclick: () => {
                  delete c.objetivo; guardar(); refrescar();
                } }, "a mano ↺")
                : el("span", { class: "rep-tag", title: "Se reparte sola con lo que queda del día" }, "auto"),
            ])),
            celda("kcal"), celda("p"), celda("g"), celda("h"),
            el("td", {}, el("button", { class: "rep-chip " + e.cls, onclick: () => irAComida(c) },
              e.total ? (e.ok === e.total ? "✓ " : "⚠ ") + e.ok + "/" + e.total + " cuadran" : "sin opciones")),
          ]);
        });
        const celdaSuma = (k) => el("td", { class: "rep-suma " + CM.estado(suma[k], dia[k], k, aj.margen).cls }, fmt(suma[k]));
        caja.appendChild(el("div", { class: "rep-scroll" }, el("table", { class: "rep-tabla" }, [
          el("thead", {}, el("tr", {}, ["Comida", "Kcal", "Proteína (g)", "Grasa (g)", "Hidratos (g)", "Opciones"].map((t) => el("th", {}, t)))),
          el("tbody", {}, filas),
          el("tfoot", {}, [
            el("tr", { class: "rep-total" }, [el("th", {}, "Suma de las comidas"), celdaSuma("kcal"), celdaSuma("p"), celdaSuma("g"), celdaSuma("h"), el("td")]),
            el("tr", { class: "rep-obj" }, [el("th", {}, "Objetivo del día"), ...MAC.map(([k]) => el("td", {}, fmt(dia[k]))), el("td")]),
          ]),
        ])));
        const v = veredicto(suma, dia, aj.margen, { ok: "✓ El reparto cuadra con el objetivo del día", falta: "Faltan por repartir ", sobra: "Te pasas " });
        caja.appendChild(el("div", { class: "rep-veredicto " + v.cls }, v.cls === "ok" ? v.texto : "⚠️ " + v.texto));
        if (foco) { const n = caja.querySelector('[data-foco="' + foco + '"]'); if (n) { n.focus(); n.select && n.select(); } }
      });

      return paso(2, "Reparto entre comidas", "Escribe las kcal o los gramos de una comida y queda fija; las que están en «auto» se reparten lo que queda del día.", b,
        [fModo, el("button", { class: "btn btn-sm", title: "Borrar lo escrito a mano y repartir todo automáticamente", onclick: () => {
          (b.comidas || []).forEach((c) => delete c.objetivo); guardar(); refrescar(); toast("Reparto automático ✓");
        } }, "↺ Todo automático")],
        [tabla]);
    }

    /* ---------- ③ Opciones de cada comida ---------- */
    function pasoComidas(b) {
      const lista = el("div", { class: "mc-lista" }, (b.comidas || []).map((c, iC) => tarjetaComida(b, c, iC)));
      const añadir = el("button", { class: "btn", onclick: () => elegirNombre("Nueva comida", NP.COMIDAS_MENU, (nom) => {
        b.comidas = b.comidas || [];
        const c = { id: NP.util.uid(), nombre: nom, texto: "", opciones: [nuevaOpcion()] };
        b.comidas.push(c);
        guardar(); pintar(); irAComida(c);
      }) }, "＋ Añadir comida");
      return paso(3, "Opciones de cada comida", "Escribe los alimentos con sus gramos, uno por línea. Cada opción te dice si cuadra con lo que lleva su comida.", b,
        null, [lista, el("div", { style: "margin-top:12px" }, añadir)]);
    }

    function tarjetaComida(b, c, iC) {
      const objC = () => objetivosComidas(b)[c.id];
      const cuerpoC = el("div", { class: "mc-cuerpo", ...(plegadas.has(c.id) ? { hidden: true } : {}) });
      const chev = el("span", { class: "mc-chev" }, plegadas.has(c.id) ? "▸" : "▾");
      const mover1 = (d) => {
        const j = iC + d;
        if (j < 0 || j >= b.comidas.length) return;
        b.comidas.splice(j, 0, b.comidas.splice(iC, 1)[0]);
        guardar(); pintar();
      };
      const cab = el("div", { class: "mc-cab" }, [
        el("button", { class: "mc-toggle", title: "Plegar o desplegar", onclick: () => {
          const pleg = !plegadas.has(c.id);
          if (pleg) plegadas.add(c.id); else plegadas.delete(c.id);
          cuerpoC.hidden = pleg; chev.textContent = pleg ? "▸" : "▾";
        } }, [chev, el("span", { class: "mc-ic" }, iconoComida(c.nombre)), el("span", { class: "mc-nom" }, c.nombre)]),
        vivo("span", { class: "mc-obj" }, (n) => {
          const o = objC();
          if (!o) return;
          n.appendChild(el("span", { class: "small muted" }, "Lleva "));
          n.appendChild(el("b", {}, textoMacros(o)));
        }),
        vivo("span", {}, (n) => {
          const e = estadoComida(c, objC());
          n.className = "mc-estado " + e.cls;
          n.textContent = e.total ? (e.ok === e.total ? "✓ " : "⚠ ") + e.ok + "/" + e.total + " cuadran" : "Sin alimentos";
        }),
        menuAcciones([
          ["✏️ Cambiar el nombre", () => elegirNombre("Cambiar el nombre", NP.COMIDAS_MENU, (nom) => { c.nombre = nom; guardar(); pintar(); }, c.nombre, "Guardar")],
          [(c.texto || conTexto.has(c.id)) ? "📝 Quitar el texto suelto" : "📝 Añadir un texto suelto", () => {
            if (c.texto || conTexto.has(c.id)) { c.texto = ""; conTexto.delete(c.id); guardar(); } else conTexto.add(c.id);
            pintar();
          }],
          iC > 0 ? ["↑ Subir", () => mover1(-1)] : null,
          iC < b.comidas.length - 1 ? ["↓ Bajar", () => mover1(1)] : null,
          ["🗑 Quitar la comida", () => {
            if (!confirm("¿Quitar «" + c.nombre + "» y sus opciones?")) return;
            b.comidas.splice(iC, 1); guardar(); pintar();
          }, true],
        ], "Acciones de la comida"),
      ]);

      if (c.texto || conTexto.has(c.id)) {
        cuerpoC.appendChild(el("label", { class: "field mc-texto" }, [el("span", {}, "Texto suelto (sale tal cual, sin opciones)"),
          campo({ value: c.texto || "", placeholder: "Ej.: 15 g de limón + 250 ml de agua" }, (v) => { c.texto = v.trim(); })]));
      }
      (c.opciones || []).forEach((op, iO) => cuerpoC.appendChild(tarjetaOpcion(c, op, iO, objC)));
      cuerpoC.appendChild(el("div", { class: "mc-pie" }, [
        el("button", { class: "btn btn-sm", onclick: () => { c.opciones = c.opciones || []; c.opciones.push(nuevaOpcion()); guardar(); pintar(); } }, "＋ Añadir opción"),
        el("button", { class: "btn btn-sm", title: "Rellenarla con una receta del recetario", onclick: () => opcionDesdeReceta(c) }, "🍽️ Opción desde una receta"),
      ]));
      return el("section", { class: "mc", id: "mc-" + c.id }, [cab, cuerpoC]);
    }

    /* ---------- Opción: alimentos como fichas con sus gramos y botones − / + ---------- */
    const guardarLuego = NP.util.debounce(guardar, 700);
    /** El texto de siempre (paciente, PDF, WhatsApp) se genera a partir de las fichas */
    const sincronizar = (op) => { op.alimentos = (op.items || []).map(CM.textoItem); };
    /** − / +: de 1 en 1 con poco, de 5 en 5 lo normal y de 10 en 10 a partir de 100 g (siempre a números redondos) */
    function pasoGramos(g, sube) {
      const s = sube ? (g < 10 ? 1 : g < 100 ? 5 : 10) : (g <= 10 ? 1 : g <= 100 ? 5 : 10);
      return Math.max(0, sube ? Math.floor(g / s) * s + s : Math.ceil(g / s) * s - s);
    }
    const redondeaG = (g) => (g < 20 ? Math.round(g) : Math.round(g / 5) * 5);

    /** Botón que se repite mientras se mantiene pulsado */
    function botonRepite(texto, titulo, fn) {
      const b = el("button", { class: "g-btn", type: "button", title: titulo, "aria-label": titulo }, texto);
      let t1 = null, t2 = null;
      const parar = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
      b.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        fn();
        t1 = setTimeout(() => { t2 = setInterval(fn, 80); }, 380);
      });
      ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((ev) => b.addEventListener(ev, parar));
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
      return b;
    }

    /** Buscador de alimentos; al elegir uno llama a onPick(id, datos) */
    function buscador(inicial, onPick, onCerrar) {
      const q = el("input", { type: "search", class: "bus-inp", value: inicial || "",
        placeholder: "Busca un alimento: arroz, pechuga de pollo, avena..." });
      const res = el("div", { class: "bus-res", hidden: true });
      let lista = [];
      function pintarRes() {
        res.innerHTML = "";
        lista = q.value.trim() ? CM.buscar(q.value, 20) : [];
        res.hidden = !q.value.trim();
        if (res.hidden) return;
        if (!lista.length) { res.appendChild(el("div", { class: "bus-vacio" }, "Sin resultados: prueba con otra palabra.")); return; }
        lista.forEach((x) => res.appendChild(el("button", { class: "bus-item", type: "button",
          onmousedown: (e) => e.preventDefault(), onclick: () => onPick(x.id, x.d) }, [
          el("span", { class: "bus-nom" }, x.d.nombre),
          el("span", { class: "bus-k" }, fmt(x.d.kcal) + " kcal · P " + fmt(x.d.p, 1) + " · G " + fmt(x.d.g, 1) + " · H " + fmt(x.d.h, 1) + " por 100 g"),
        ])));
      }
      q.addEventListener("input", NP.util.debounce(pintarRes, 120));
      q.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && lista.length) { e.preventDefault(); onPick(lista[0].id, lista[0].d); }
        if (e.key === "Escape" && onCerrar) onCerrar();
      });
      const caja = el("div", { class: "bus" }, [q, res]);
      caja.enfocar = () => { q.focus(); if (q.value) pintarRes(); };
      return caja;
    }

    /** Cambiar el alimento de una ficha (o elegirlo si estaba pendiente) */
    function cambiarAlimento(it, onHecho) {
      const pendiente = !it.fid;
      const leido = pendiente ? CM.leer(it.nombre) : null;
      const bus = buscador(pendiente ? leido.nombre : it.nombre, (id, d) => {
        it.fid = id;
        it.nombre = d.nombre;
        delete it.casera;
        if (it.g == null) it.g = leido && leido.g != null ? Math.round(leido.g) : 100;
        m.close(); onHecho();
      });
      const m = modal({
        title: pendiente ? "¿Qué alimento es «" + it.nombre + "»?" : "Cambiar «" + it.nombre + "» por otro alimento",
        wide: true,
        body: el("div", {}, [
          el("div", { class: "small muted", style: "margin-bottom:8px" }, pendiente
            ? "Esta línea venía escrita a mano y no se reconoció. Elige el alimento de la tabla."
            : "Se mantienen los gramos (" + fmt(it.g) + " g)."),
          bus,
        ]),
        footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar")],
      });
      setTimeout(bus.enfocar, 60);
    }

    /** Rellena una opción con una receta del tamaño elegido: nombre, alimentos, gramos y preparación */
    function llenarConReceta(op, r, factor) {
      const esc = factor && factor !== 1 ? NP.slot.escalar(r, factor) : r;
      op.titulo = r.nombre;
      op.items = (esc.ingredientes || []).map((i) => Object.assign(
        { id: NP.util.uid(), fid: i.f_id, nombre: i.nombre, g: Math.round(Number(i.gramos) || 0) },
        // La medida casera («2 rebanadas») solo vale con la ración normal
        (!factor || factor === 1) && i.casera ? { casera: i.casera } : {}));
      op.preparacion = (r.elaboracion || []).join(" ");
      sincronizar(op);
    }
    const sufijoTam = (tam) => (tam && tam !== "M" ? " (" + tam + ")" : "");

    function tarjetaOpcion(c, op, iO, objC) {
      // Los menús de antes guardaban líneas de texto: se pasan a fichas una sola vez
      if (!Array.isArray(op.items)) { op.items = CM.lineasAItems(op.alimentos, plan.enlaces); sincronizar(op); guardarLuego(); }
      const fTit = campo({ value: op.titulo || "", class: "oc-tit", placeholder: "Ponle un nombre (opcional)" }, (v) => { op.titulo = v.trim(); });
      const filas = el("div", { class: "al-lista" });
      const zonaBus = el("div", { class: "al-bus" });
      const cambio = (lento) => { sincronizar(op); (lento ? guardarLuego : guardar)(); refrescar(); };
      const moverO = (d) => {
        const j = iO + d;
        if (j < 0 || j >= c.opciones.length) return;
        c.opciones.splice(j, 0, c.opciones.splice(iO, 1)[0]);
        guardar(); pintar();
      };
      const verPrep = op.preparacion || conPrep.has(op.id);

      const quitar = (idx) => el("button", { class: "icon-btn al-quitar", type: "button", title: "Quitar este alimento", onclick: () => {
        op.items.splice(idx, 1); pintarFilas(); cambio();
      } }, "✕");

      function fila(it, idx) {
        if (it.libre) {
          return el("div", { class: "al-fila libre" }, [
            el("span", { class: "al-nom" }, it.nombre), el("span", { class: "al-nota" }, "al gusto · no suma"), quitar(idx)]);
        }
        if (!it.fid || it.g == null) {
          return el("div", { class: "al-fila pendiente" }, [
            el("span", { class: "al-nom" }, it.nombre),
            el("button", { class: "btn btn-sm", type: "button", onclick: () => cambiarAlimento(it, () => { pintarFilas(); cambio(); }) }, "⚠️ Elegir el alimento"),
            quitar(idx)]);
        }
        const kc = el("span", { class: "al-k" });
        const pintarK = () => {
          const x = CM.calcularItem(it).n;
          kc.innerHTML = "";
          kc.appendChild(el("b", {}, fmt(x.kcal) + " kcal"));
          kc.appendChild(el("span", {}, "P " + fmt(x.p) + " · G " + fmt(x.g) + " · H " + fmt(x.h)));
        };
        const casera = it.casera ? el("span", { class: "al-casera" }, it.casera) : null;
        const gIn = el("input", { type: "number", min: 0, step: 1, class: "al-g", value: it.g, inputmode: "numeric", "aria-label": "Gramos de " + it.nombre });
        const sinCasera = () => { if (it.casera) { delete it.casera; if (casera) casera.remove(); } };
        const poner = (g) => { it.g = Math.max(0, Math.round(g)); sinCasera(); gIn.value = it.g; pintarK(); cambio(true); };
        gIn.addEventListener("input", () => { if (gIn.value === "") return; it.g = Math.max(0, num(gIn.value)); sinCasera(); pintarK(); cambio(true); });
        gIn.addEventListener("change", () => { it.g = Math.round(num(gIn.value)); gIn.value = it.g; pintarK(); cambio(false); });
        gIn.addEventListener("focus", () => gIn.select());
        pintarK();
        const d = CM.datos(it.fid);
        return el("div", { class: "al-fila" }, [
          el("button", { class: "al-nom", type: "button", title: "Cambiar por otro alimento" + (d && d.nombre !== it.nombre ? " · en la tabla: " + d.nombre : ""),
            onclick: () => cambiarAlimento(it, () => { pintarFilas(); cambio(); }) }, [el("span", {}, it.nombre), casera]),
          el("div", { class: "al-cant" }, [
            botonRepite("−", "Menos gramos", () => poner(pasoGramos(it.g, false))),
            gIn, el("span", { class: "al-u" }, "g"),
            botonRepite("+", "Más gramos", () => poner(pasoGramos(it.g, true))),
          ]),
          kc,
          quitar(idx),
        ]);
      }
      function pintarFilas() {
        filas.innerHTML = "";
        if (!op.items.length) {
          filas.appendChild(el("div", { class: "al-vacio" }, "Sin alimentos todavía. Añádelos con el buscador o pon una receta."));
          return;
        }
        op.items.forEach((it, idx) => filas.appendChild(fila(it, idx)));
      }
      pintarFilas();

      function abrirBuscador() {
        zonaBus.innerHTML = "";
        const bus = buscador("", (id, d) => {
          op.items.push({ id: NP.util.uid(), fid: id, nombre: d.nombre, g: 100 });
          cerrar(); pintarFilas(); cambio();
          const ultimo = filas.querySelectorAll(".al-g");
          if (ultimo.length) { ultimo[ultimo.length - 1].focus(); }
        }, () => cerrar());
        const cerrar = () => { zonaBus.innerHTML = ""; botones.hidden = false; };
        botones.hidden = true;
        zonaBus.appendChild(el("div", { class: "al-bus-fila" }, [bus,
          el("button", { class: "btn btn-sm btn-ghost", type: "button", onclick: cerrar }, "Cerrar")]));
        bus.enfocar();
      }
      const botones = el("div", { class: "al-botones" }, [
        el("button", { class: "btn btn-sm", type: "button", onclick: abrirBuscador }, "＋ Añadir alimento"),
        el("button", { class: "btn btn-sm", type: "button", title: "Pone el nombre, los alimentos y los gramos de una receta, en el tamaño que elijas",
          onclick: () => recetaEnOpcion(op) }, "🍽️ Poner una receta"),
        vivo("span", {}, (n) => {
          const o = objC();
          const t = CM.calcularOpcion(op).n;
          if (!o || !(t.kcal > 0) || CM.estado(t.kcal, o.kcal, "kcal", aj.margen).cls === "ok") return;
          n.appendChild(el("button", { class: "btn btn-sm al-ajustar", type: "button",
            title: "Sube o baja todos los alimentos en la misma proporción hasta las kcal de la comida", onclick: () => {
              const f = o.kcal / t.kcal;
              op.items.forEach((it) => { if (it.fid && it.g != null && !it.libre) { it.g = redondeaG(it.g * f); delete it.casera; } });
              pintarFilas(); cambio(); toast("Cantidades ajustadas a unas " + fmt(o.kcal) + " kcal");
            } }, "⚖️ Ajustar cantidades a " + fmt(o.kcal) + " kcal"));
        }),
      ]);

      return el("div", { class: "oc" }, [
        el("div", { class: "oc-cab" }, [
          el("span", { class: "oc-num" }, "Opción " + (iO + 1)),
          fTit,
          vivo("span", {}, (n) => {
            if (!(op.items || []).length) { n.className = "oc-ver"; n.textContent = "Sin alimentos"; return; }
            const v = veredicto(CM.calcularOpcion(op).n, objC(), aj.margen);
            n.className = "oc-ver " + v.cls;
            n.textContent = v.texto;
          }),
          menuAcciones([
            [verPrep ? "📝 Quitar la preparación" : "📝 Añadir cómo se prepara", () => {
              if (verPrep) { op.preparacion = ""; conPrep.delete(op.id); guardar(); } else conPrep.add(op.id);
              pintar();
            }],
            ["⧉ Duplicar", () => {
              const copia = JSON.parse(JSON.stringify(op));
              copia.id = NP.util.uid();
              (copia.items || []).forEach((it) => { it.id = NP.util.uid(); });
              c.opciones.splice(iO + 1, 0, copia);
              guardar(); pintar();
            }],
            iO > 0 ? ["↑ Subir", () => moverO(-1)] : null,
            iO < c.opciones.length - 1 ? ["↓ Bajar", () => moverO(1)] : null,
            ["🗑 Quitar la opción", () => { c.opciones.splice(iO, 1); guardar(); pintar(); }, true],
          ], "Acciones de la opción"),
        ]),
        filas,
        el("div", { class: "al-pie" }, [botones, zonaBus]),
        vivo("div", { class: "oc-med" }, (caja) => {
          if (!(op.items || []).length) return;
          const r = CM.calcularOpcion(op);
          caja.appendChild(el("div", { class: "oc-med-fila" }, [
            el("span", { class: "oc-total" }, "Total"),
            fichasMedidor(r.n, objC(), aj.margen),
            r.dudosas ? el("span", { class: "med-aviso" }, "⚠️ " + r.dudosas + (r.dudosas === 1 ? " alimento sin elegir" : " alimentos sin elegir")) : null,
          ]));
        }),
        verPrep ? el("label", { class: "field oc-prep" }, [el("span", {}, "Cómo se prepara"),
          campo({ rows: 2, value: op.preparacion || "", placeholder: "Cómo se hace, si hace falta explicarlo" },
            (v) => { op.preparacion = v.trim(); }, true)]) : null,
      ]);
    }

    /** Pone una receta en una opción que ya existe */
    function recetaEnOpcion(op) {
      NP.comp.recipePicker({
        title: "Poner una receta en la opción (elige el tamaño)",
        onPick: (r, factor, tam) => {
          if ((op.items || []).length && !confirm("Esta opción ya tiene alimentos. ¿Sustituirlos por «" + r.nombre + "»?")) return;
          llenarConReceta(op, r, factor);
          guardar(); pintar(); toast("Receta puesta" + sufijoTam(tam) + " ✓");
        },
      });
    }

    /** Opción nueva a partir de una receta */
    function opcionDesdeReceta(c) {
      NP.comp.recipePicker({
        title: "Nueva opción desde una receta (elige el tamaño)",
        onPick: (r, factor, tam) => {
          const op = nuevaOpcion();
          llenarConReceta(op, r, factor);
          c.opciones = c.opciones || [];
          c.opciones.push(op);
          guardar(); pintar(); toast("Opción añadida" + sufijoTam(tam) + " ✓");
        },
      });
    }

    /** Copia las comidas de un tipo de día en otro (entreno -> descanso) */
    function copiarBloque(origen) {
      const otros = plan.bloques.filter((x) => x.id !== origen.id);
      const sel = el("select", {}, otros.map((b) => el("option", { value: b.id }, b.nombre)));
      const m = modal({
        title: "⧉ Copiar las comidas de «" + origen.nombre + "»",
        body: el("div", {}, [
          el("label", { class: "field" }, [el("span", {}, "Copiarlas en"), sel]),
          el("div", { class: "small muted" }, "Se añaden al final; no se borra nada de lo que ya tenga."),
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

    /* ---------- Suplementación: la misma todos los días ---------- */
    function seccionSuplementos() {
      const lista = el("div", { class: "sup-lista" });
      plan.suplementos.forEach((s, i) => lista.appendChild(el("div", { class: "oc" }, [
        el("div", { class: "oc-cab" }, [
          campo({ value: s.nombre, class: "oc-tit", placeholder: "Creatina, omega-3, magnesio..." }, (v) => { s.nombre = v.trim(); }),
          menuAcciones([
            i > 0 ? ["↑ Subir", () => { plan.suplementos.splice(i - 1, 0, plan.suplementos.splice(i, 1)[0]); guardar(); pintar(); }] : null,
            i < plan.suplementos.length - 1 ? ["↓ Bajar", () => { plan.suplementos.splice(i + 1, 0, plan.suplementos.splice(i, 1)[0]); guardar(); pintar(); }] : null,
            ["🗑 Quitar", () => { plan.suplementos.splice(i, 1); guardar(); pintar(); }, true],
          ], "Acciones del suplemento"),
        ]),
        campo({ rows: 2, class: "oc-alim", value: (s.lineas || []).join("\n"), placeholder: "5 g todos los días.\nTambién los días de descanso." },
          (v) => { s.lineas = lineas(v); }, true),
      ])));

      return el("section", { class: "paso paso-sup" }, [
        el("div", { class: "paso-cab" }, [
          el("span", { class: "paso-n" }, "💊"),
          el("div", { class: "paso-tit" }, [
            el("h3", {}, "Suplementación"),
            el("div", { class: "small muted" }, "Para todos los tipos de día."),
          ]),
        ]),
        el("div", { class: "paso-cuerpo" }, [
          plan.suplementos.length ? lista : el("div", { class: "small muted" }, "Sin suplementos."),
          el("button", { class: "btn btn-sm", style: "margin-top:10px", onclick: () => {
            plan.suplementos.push({ id: NP.util.uid(), nombre: "", lineas: [] }); guardar(); pintar();
          } }, "＋ Añadir suplemento"),
        ]),
      ]);
    }

    /** Pide un nombre ofreciendo los habituales con un clic */
    function elegirNombre(titulo, sugerencias, onOk, valor, textoBoton) {
      const inp = el("input", { placeholder: "Escribe el nombre", value: valor || "" });
      const ok = () => {
        if (!inp.value.trim()) { toast("Escribe un nombre o elige uno"); return; }
        m.close(); onOk(inp.value.trim());
      };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
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
          el("button", { class: "btn btn-primary", onclick: ok }, textoBoton || "Añadir"),
        ],
      });
      setTimeout(() => inp.focus(), 50);
    }

    pintar();
  }

  return { editor, vista, resumen, nOpciones, nComidas };
})();
