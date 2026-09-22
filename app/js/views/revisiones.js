/* views/revisiones.js — seguimiento del paciente: revisiones (peso, pliegues y
   perímetros), gráfica de progresión y fotos para comparar la evolución.
   El nutricionista entra desde la ficha del paciente («📈 Revisiones») y el
   paciente lo ve en su apartado «Mi progreso». */
NP.views = NP.views || {};

NP.views.revisiones = (function () {
  const { el, fmt, modal, toast } = NP.util;
  const A = NP.antropo;

  const POSES = [
    { key: "frente", label: "De frente" },
    { key: "perfil", label: "De perfil" },
    { key: "espalda", label: "De espalda" },
    { key: "otra", label: "Otra" },
  ];
  const MAX_MB = 10;

  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const fechaLarga = (iso) => {
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? String(iso) : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };
  const ms = (iso) => new Date(String(iso).slice(0, 10) + "T00:00:00").getTime();
  const num = (v) => { const s = String(v).trim(); if (s === "") return null; const n = Number(s); return isNaN(n) ? null : n; };
  const peso = (b) => (!b ? "" : b < 1048576 ? fmt(Math.max(1, b / 1024)) + " KB" : fmt(b / 1048576, 1) + " MB");

  /** Edad que tenía el paciente en la fecha de la revisión (la fórmula la necesita) */
  function edadEn(p, iso) {
    if (!p.fecha_nacimiento) return null;
    const n = new Date(p.fecha_nacimiento + "T00:00:00");
    const f = new Date(String(iso).slice(0, 10) + "T00:00:00");
    if (isNaN(n) || isNaN(f)) return null;
    let a = f.getFullYear() - n.getFullYear();
    const m = f.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && f.getDate() < n.getDate())) a--;
    return a >= 0 && a < 130 ? a : null;
  }

  const revisionesDe = (id) => NP.store.registrosDe(id, "revision");
  const fotosDe = (id) => NP.store.registrosDe(id, "foto");

  /** La ficha del paciente refleja siempre la última revisión (peso y composición) */
  function volcarEnFicha(p) {
    const ult = revisionesDe(p.id).slice(-1)[0];
    if (!ult) return;
    if (ult.peso_kg != null) p.peso_kg = ult.peso_kg;
    if (ult.grasa_pct != null) p.grasa_pct = ult.grasa_pct;
    if (ult.musculo_pct != null) p.musculo_pct = ult.musculo_pct;
    NP.store.savePacienteGlobal(p);
  }

  /* ================= Formulario de revisión ================= */
  function formRevision(p, existente, onHecho) {
    const r = existente || { tipo: "revision", pacienteId: p.id, fecha: hoyISO(), pliegues: {}, medidas: {} };
    const fFecha = el("input", { type: "date", value: String(r.fecha || hoyISO()).slice(0, 10), max: hoyISO() });
    const fPeso = el("input", { type: "number", step: 0.1, min: 20, max: 350, value: r.peso_kg ?? "", placeholder: "kg" });
    const fMusculo = el("input", { type: "number", step: 0.1, min: 1, max: 80, value: r.musculo_pct ?? "", placeholder: "%" });
    const fGrasaMan = el("input", { type: "number", step: 0.1, min: 1, max: 70, value: r.grasa_pct ?? "", placeholder: "%" });
    const fNota = el("textarea", { rows: 2, placeholder: "Cómo llega, adherencia, entrenos, sensaciones..." }, [r.nota || ""]);

    // Los 7 pliegues
    const campos = {};
    A.PLIEGUES.forEach((pl) => {
      campos[pl.key] = el("input", { type: "number", step: 0.1, min: 1, max: 80,
        value: (r.pliegues && r.pliegues[pl.key]) ?? "", placeholder: "mm", title: pl.ayuda });
      campos[pl.key].addEventListener("input", recalcular);
    });
    const medidas = {};
    A.MEDIDAS.forEach((md) => {
      medidas[md.key] = el("input", { type: "number", step: 0.1, min: 10, max: 250,
        value: (r.medidas && r.medidas[md.key]) ?? "", placeholder: "cm" });
    });

    const edad = edadEn(p, fFecha.value);
    const resultado = el("div", { class: "jp-res" });
    let calculo = null;

    function leerPliegues() {
      const o = {};
      A.PLIEGUES.forEach((pl) => { const v = num(campos[pl.key].value); if (v != null) o[pl.key] = v; });
      return o;
    }
    function recalcular() {
      const pl = leerPliegues();
      const e = edadEn(p, fFecha.value);
      resultado.innerHTML = "";
      calculo = null;
      if (!Object.keys(pl).length) {
        resultado.appendChild(el("div", { class: "small muted" },
          "Rellena los 7 pliegues y se calcula sola la grasa corporal (Jackson-Pollock)."));
        return;
      }
      if (e == null) {
        resultado.appendChild(el("div", { class: "auth-error", style: "margin:0" },
          "Para calcular la grasa por pliegues hace falta la fecha de nacimiento del paciente. " +
          "Edita su ficha y añádela, o escribe el % de grasa a mano."));
        return;
      }
      const faltan = A.faltan(pl);
      if (faltan) {
        resultado.appendChild(el("div", { class: "small muted" },
          `Faltan ${faltan} pliegue(s) por medir · suma parcial ${fmt(Object.values(pl).reduce((s, v) => s + v, 0), 1)} mm`));
        return;
      }
      const jp = A.jacksonPollock7(pl, e, p.sexo);
      if (!jp) { resultado.appendChild(el("div", { class: "small muted" }, "Esas medidas no dan un resultado válido; revísalas.")); return; }
      calculo = jp;
      const pk = num(fPeso.value);
      const comp = A.composicion(pk, jp.grasa_pct);
      resultado.appendChild(el("div", { class: "kpis" }, [
        kpi("Suma 7 pliegues", fmt(jp.suma, 1) + " mm"),
        kpi("Densidad corporal", fmt(jp.densidad, 4)),
        kpiAcento("Grasa corporal", fmt(jp.grasa_pct, 1) + " %"),
        comp ? kpi("Masa grasa", fmt(comp.grasa_kg, 1) + " kg") : null,
        comp ? kpi("Masa magra", fmt(comp.magra_kg, 1) + " kg") : null,
      ].filter(Boolean)));
      resultado.appendChild(el("div", { class: "small muted", style: "margin-top:8px" },
        `Jackson-Pollock 7 pliegues + Siri · ${e} años · ${NP.calorias.normSexo(p.sexo) === "indeterminado" ? "sexo sin especificar (promedio de ambas fórmulas)" : p.sexo} · ` +
        A.clasificar(jp.grasa_pct, p.sexo)));
    }
    fFecha.addEventListener("change", recalcular);
    fPeso.addEventListener("input", recalcular);

    const body = el("div", {}, [
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Fecha de la revisión"), fFecha]),
        el("label", { class: "field" }, [el("span", {}, "Peso (kg)"), fPeso]),
        el("label", { class: "field" }, [el("span", {}, "Masa muscular (%) · opcional"), fMusculo]),
      ]),
      el("div", { class: "sec-tit" }, "📏 Pliegues cutáneos (mm)"),
      el("div", { class: "pliegues" }, A.PLIEGUES.map((pl) =>
        el("label", { class: "field", title: pl.ayuda }, [
          el("span", {}, pl.label),
          campos[pl.key],
          el("small", { class: "muted" }, pl.ayuda),
        ]))),
      resultado,
      el("div", { class: "sec-tit" }, "📐 Perímetros (cm)"),
      el("div", { class: "pliegues" }, A.MEDIDAS.map((md) =>
        el("label", { class: "field" }, [el("span", {}, md.label), medidas[md.key]]))),
      el("div", { class: "sec-tit" }, "✍️ Otros datos"),
      el("label", { class: "field" }, [
        el("span", {}, "Grasa corporal a mano (%) · solo si no mides pliegues"), fGrasaMan,
      ]),
      el("label", { class: "field" }, [el("span", {}, "Nota de la revisión"), fNota]),
    ]);

    const m = modal({
      title: existente ? "Editar revisión" : "📈 Nueva revisión", body, wide: true,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: guardar }, "Guardar revisión"),
      ],
    });
    recalcular();

    function guardar() {
      const pl = leerPliegues();
      const grasa = calculo ? calculo.grasa_pct : num(fGrasaMan.value);
      const med = {};
      A.MEDIDAS.forEach((md) => { const v = num(medidas[md.key].value); if (v != null) med[md.key] = v; });
      if (num(fPeso.value) == null && grasa == null && !Object.keys(med).length) {
        toast("Apunta al menos el peso"); return;
      }
      const guardado = NP.store.saveRegistro(Object.assign({}, r, {
        tipo: "revision", pacienteId: p.id, fecha: fFecha.value || hoyISO(),
        peso_kg: num(fPeso.value), grasa_pct: grasa, musculo_pct: num(fMusculo.value),
        metodo: calculo ? "jp7" : "manual",
        suma_pliegues: calculo ? calculo.suma : null,
        densidad: calculo ? calculo.densidad : null,
        pliegues: pl, medidas: med, nota: fNota.value.trim(),
      }));
      volcarEnFicha(p);
      m.close();
      toast("Revisión guardada ✓");
      onHecho && onHecho(guardado);
    }
  }

  /** El paciente solo anota su peso; los pliegues los mide el nutricionista */
  function formPesoPaciente(p, onHecho) {
    const fFecha = el("input", { type: "date", value: hoyISO(), max: hoyISO() });
    const fPeso = el("input", { type: "number", step: 0.1, min: 20, max: 350, value: p.peso_kg ?? "", placeholder: "kg" });
    const fNota = el("input", { placeholder: "Opcional: en ayunas, después de entrenar..." });
    const avisar = el("input", { type: "checkbox", checked: true, style: "width:auto;margin:0;flex:0 0 auto" });
    const m = modal({
      title: "⚖️ Anotar mi peso",
      body: el("div", {}, [
        el("div", { class: "row" }, [
          el("label", { class: "field" }, [el("span", {}, "Fecha"), fFecha]),
          el("label", { class: "field" }, [el("span", {}, "Peso (kg)"), fPeso]),
        ]),
        el("label", { class: "field" }, [el("span", {}, "Nota"), fNota]),
        el("label", { class: "row", style: "gap:8px;align-items:center;cursor:pointer" }, [
          avisar, el("span", { class: "small muted" }, "Avisar a mi nutricionista por el chat"),
        ]),
        el("div", { class: "small muted", style: "margin-top:8px" }, "Se añade a tu gráfica de progresión."),
      ]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const v = num(fPeso.value);
          if (v == null || v < 20 || v > 350) { toast("Escribe un peso válido"); return; }
          const anterior = p.peso_kg;
          NP.store.saveRegistro({
            tipo: "revision", pacienteId: p.id, fecha: fFecha.value || hoyISO(),
            peso_kg: v, grasa_pct: null, musculo_pct: null, metodo: "manual",
            pliegues: {}, medidas: {}, nota: fNota.value.trim(), origen: "paciente",
          });
          p.peso_kg = v;
          NP.store.savePacienteGlobal(p);
          if (avisar.checked) {
            NP.store.saveMensaje({
              pacienteId: p.id, autor: "paciente", canal: "app",
              texto: `⚖️ Peso actualizado: ${fmt(v, 1)} kg` + (anterior != null ? ` (antes ${fmt(anterior, 1)} kg)` : "") +
                (fNota.value.trim() ? "\n" + fNota.value.trim() : ""),
            });
          }
          m.close(); toast("Peso anotado ✓");
          onHecho && onHecho();
        } }, "Guardar"),
      ],
    });
  }

  /* ================= Gráfica de progresión ================= */
  /** ¿Hay alguna revisión con % de grasa? (lo mide el nutricionista) */
  const hayGrasa = (revs) => revs.some((r) => r.grasa_pct != null);

  function grafica(p) {
    const revs = revisionesDe(p.id);
    const pesos = revs.filter((r) => r.peso_kg != null).map((r) => ({ x: ms(r.fecha), y: r.peso_kg }));
    const grasas = revs.filter((r) => r.grasa_pct != null).map((r) => ({ x: ms(r.fecha), y: r.grasa_pct }));
    if (pesos.length + grasas.length < 2) {
      return NP.grafica.vacia("Con dos revisiones ya se dibuja la evolución del peso y de la grasa corporal.");
    }
    // La grasa va en el eje derecho para no mezclarse con los kg; si no hay peso, se queda sola a la izquierda
    return NP.grafica.lineas({
      alto: 280,
      series: [
        pesos.length ? { nombre: "Peso", unidad: "kg", color: "var(--accent)", eje: "izq", dec: 1, puntos: pesos } : null,
        grasas.length ? { nombre: "Grasa corporal", unidad: "%", color: "var(--c-g)",
          eje: pesos.length ? "der" : "izq", dec: 1, puntos: grasas } : null,
      ].filter(Boolean),
    });
  }

  /** Aviso sobre de dónde sale el % de grasa, según quién mire y si ya hay medidas */
  function notaGrasa(revs, esNutri) {
    if (!revs.length) return null;
    if (hayGrasa(revs)) {
      return el("div", { class: "small muted", style: "margin-top:8px" }, esNutri
        ? "📏 La curva de grasa sale de los pliegues que mides en cada revisión."
        : "⚖️ El peso lo anotas tú · 📏 el % de grasa corporal lo mide tu nutricionista en la revisión, con los 7 pliegues.");
    }
    return el("div", { class: "nota-pdf", style: "margin-top:12px" }, esNutri
      ? [el("b", {}, "Sin perfil graso todavía. "),
         "En cuanto midas los 7 pliegues en una revisión, la app calcula el % de grasa y aparece " +
         "su curva junto al peso, aquí y en la app del paciente."]
      : [el("b", {}, "Aquí solo sale tu peso de momento. "),
         "El % de grasa corporal se saca midiendo los pliegues, y eso lo hace tu nutricionista en la " +
         "revisión: en cuanto te lo mida, verás también esa curva."]);
  }

  /* ================= Lista de revisiones ================= */
  function tarjetaRevision(p, r, anterior, editable, recargar) {
    const dif = (a, b, dec = 1) => {
      if (a == null || b == null) return null;
      const d = a - b;
      if (Math.abs(d) < 0.05) return el("span", { class: "dlt" }, "=");
      return el("span", { class: "dlt " + (d < 0 ? "baja" : "sube") }, (d > 0 ? "+" : "−") + fmt(Math.abs(d), dec));
    };
    const comp = A.composicion(r.peso_kg, r.grasa_pct);
    const icc = A.cinturaCadera(r.medidas && r.medidas.cintura, r.medidas && r.medidas.cadera, p.sexo);
    const medidas = A.MEDIDAS.filter((md) => r.medidas && r.medidas[md.key] != null)
      .map((md) => md.label + " " + fmt(r.medidas[md.key], 1));

    return el("div", { class: "panel rev-card" }, [
      el("div", { class: "row", style: "align-items:center;gap:10px" }, [
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, fechaLarga(r.fecha)),
          el("div", { class: "small muted" }, [
            r.metodo === "jp7" ? "7 pliegues · suma " + fmt(r.suma_pliegues, 1) + " mm" : "Medida a mano",
            r.origen === "paciente" ? " · anotado por el paciente" : "",
          ].join("")),
        ]),
        editable ? el("button", { class: "btn btn-sm", onclick: () => formRevision(p, r, recargar) }, "Editar") : null,
        editable || r.origen === "paciente" ? el("button", { class: "btn btn-sm btn-danger", onclick: () => {
          if (!confirm("¿Borrar la revisión del " + fechaLarga(r.fecha) + "?")) return;
          NP.store.deleteRegistro(r.id); volcarEnFicha(p); toast("Revisión borrada"); recargar();
        } }, "🗑") : null,
      ]),
      el("div", { class: "kpis", style: "margin-top:12px" }, [
        r.peso_kg != null ? kpi("Peso", [fmt(r.peso_kg, 1) + " kg ", anterior ? dif(r.peso_kg, anterior.peso_kg) : null]) : null,
        r.grasa_pct != null ? kpi("Grasa", [fmt(r.grasa_pct, 1) + " % ", anterior ? dif(r.grasa_pct, anterior.grasa_pct) : null]) : null,
        comp ? kpi("Masa grasa", fmt(comp.grasa_kg, 1) + " kg") : null,
        comp ? kpi("Masa magra", fmt(comp.magra_kg, 1) + " kg") : null,
        r.musculo_pct != null ? kpi("Músculo", fmt(r.musculo_pct, 1) + " %") : null,
        icc ? kpi("Cintura/cadera", icc.valor + " · " + icc.riesgo) : null,
      ].filter(Boolean)),
      medidas.length ? el("div", { class: "small muted", style: "margin-top:10px" }, "📐 " + medidas.join(" · ") + " cm") : null,
      r.nota ? el("div", { class: "small muted", style: "margin-top:8px;white-space:pre-wrap" }, "📝 " + r.nota) : null,
    ]);
  }

  /* ================= Fotos de progreso ================= */
  const urls = [];
  function liberarUrls() { urls.splice(0).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* ya liberada */ } }); }

  /** <img> que carga su archivo (IndexedDB en local, enlace firmado en la nube) */
  function imagen(reg, clase) {
    const img = el("img", { class: clase || "foto-img", alt: "Foto del " + fechaLarga(reg.fecha), loading: "lazy" });
    NP.store.urlFoto(reg).then((u) => {
      if (u.startsWith("blob:")) urls.push(u);
      img.src = u;
    }).catch(() => { img.replaceWith(el("div", { class: "foto-rota" }, "No se encuentra la foto")); });
    return img;
  }

  const poseDe = (f) => POSES.find((o) => o.key === f.pose) || POSES[3];
  const ordenPose = (a, b) => POSES.indexOf(poseDe(a)) - POSES.indexOf(poseDe(b));
  const diaDe = (f) => String(f.fecha).slice(0, 10);
  /** Por qué no vale un archivo como foto (o null si vale) */
  function fallaImagen(f) {
    if (!/^image\//.test(f.type)) return "«" + f.name + "» no es una imagen (JPG, PNG...).";
    if (f.size > MAX_MB * 1048576) return `«${f.name}» pesa ${peso(f.size)}; el máximo son ${MAX_MB} MB.`;
    return null;
  }

  /** Subir las fotos de un día: un hueco por pose (frente, perfil, espalda...) con la misma fecha.
   *  `fechaIni` sirve para añadir fotos a un día que ya tiene alguna. */
  function formFoto(p, onHecho, fechaIni) {
    const fFecha = el("input", { type: "date", value: fechaIni || hoyISO(), max: hoyISO() });
    const fNota = el("input", { placeholder: "Opcional: peso del día, semana del plan..." });
    const err = el("div", { class: "auth-error", hidden: true });
    const aviso = (t) => { err.textContent = t; err.hidden = !t; };

    // Cada pose tiene su propio hueco para elegir o arrastrar su foto
    const huecos = POSES.map((o) => {
      const h = { pose: o.key, archivos: [] };
      const fFile = el("input", { type: "file", accept: "image/*", multiple: o.key === "otra" });
      const tx = el("div", { class: "small" }, "Elegir foto");
      const ya = el("div", { class: "small muted" }, "");
      h.drop = el("label", { class: "doc-drop foto-hueco" }, [el("b", {}, o.label), tx, ya, fFile]);
      h.marcarYa = (n) => { ya.textContent = n ? "ya hay " + n + " este día" : ""; };
      function elegir(lista) {
        const fs = Array.from(lista || []);
        if (!fs.length) return;
        const mal = fs.map(fallaImagen).find(Boolean);
        if (mal) { aviso(mal); return; }
        aviso("");
        h.archivos = fs;
        h.drop.classList.add("lleno");
        tx.textContent = "✓ " + (fs.length === 1 ? fs[0].name : fs.length + " fotos");
      }
      fFile.addEventListener("change", () => elegir(fFile.files));
      h.drop.addEventListener("dragover", (e) => { e.preventDefault(); h.drop.classList.add("encima"); });
      h.drop.addEventListener("dragleave", () => h.drop.classList.remove("encima"));
      h.drop.addEventListener("drop", (e) => { e.preventDefault(); h.drop.classList.remove("encima"); elegir(e.dataTransfer.files); });
      return h;
    });
    // Qué poses tiene ya ese día, para no repetirlas sin querer
    function marcarExistentes() {
      const delDia = fotosDe(p.id).filter((f) => diaDe(f) === fFecha.value);
      huecos.forEach((h) => h.marcarYa(delDia.filter((f) => poseDe(f).key === h.pose).length));
    }
    fFecha.addEventListener("change", marcarExistentes);
    marcarExistentes();

    const btn = el("button", { class: "btn btn-primary", onclick: subir }, "Subir fotos");
    const m = modal({
      title: fechaIni ? "📷 Añadir fotos del " + fechaLarga(fechaIni) : "📷 Fotos de la revisión",
      body: el("div", {}, [
        el("label", { class: "field" }, [el("span", {}, "Fecha"), fFecha]),
        el("div", { class: "small muted", style: "margin:0 0 8px" }, "Pon cada foto en su pose; todas quedan juntas en el mismo día."),
        el("div", { class: "foto-huecos" }, huecos.map((h) => h.drop)),
        el("label", { class: "field", style: "margin-top:12px" }, [el("span", {}, "Nota"), fNota]),
        el("div", { class: "small muted" },
          "Consejo: siempre en el mismo sitio, con la misma luz y la misma ropa; así la comparación es fiable."),
        err,
      ]),
      footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"), btn],
    });

    async function subir() {
      const total = huecos.reduce((s, h) => s + h.archivos.length, 0);
      if (!total) { aviso("Elige al menos una foto."); return; }
      btn.disabled = true; btn.textContent = "Subiendo...";
      try {
        for (const h of huecos) {
          for (const f of h.archivos) {
            await NP.store.subirFoto(f, {
              pacienteId: p.id, fecha: fFecha.value || hoyISO(),
              pose: h.pose, nota: fNota.value.trim(),
            });
          }
        }
        m.close(); toast(total > 1 ? total + " fotos subidas ✓" : "Foto subida ✓");
        onHecho && onHecho();
      } catch (e) {
        btn.disabled = false; btn.textContent = "Subir fotos";
        aviso(e.message);
      }
    }
  }

  /** Hueco de una pose que falta en un día: al pulsarlo se elige la foto y se sube directamente */
  function huecoRapido(p, fecha, pose, recargar) {
    const fFile = el("input", { type: "file", accept: "image/*", style: "display:none" });
    const tx = el("span", { class: "small" }, "＋ " + pose.label);
    fFile.addEventListener("change", async () => {
      const f = fFile.files && fFile.files[0];
      if (!f) return;
      const mal = fallaImagen(f);
      if (mal) { toast("⚠️ " + mal); return; }
      tx.textContent = "Subiendo...";
      try {
        await NP.store.subirFoto(f, { pacienteId: p.id, fecha, pose: pose.key, nota: "" });
        toast("Foto " + pose.label.toLowerCase() + " añadida ✓"); recargar();
      } catch (e) { tx.textContent = "＋ " + pose.label; toast("⚠️ " + e.message); }
    });
    return el("label", { class: "foto-card foto-falta", title: "Añadir la foto " + pose.label.toLowerCase() + " de este día" }, [tx, fFile]);
  }

  /** Dos fotos lado a lado para ver el cambio */
  function comparar(p) {
    const fotos = fotosDe(p.id);
    if (fotos.length < 2) { toast("Hacen falta al menos dos fotos"); return; }
    const fechas = [...new Set(fotos.map((f) => String(f.fecha).slice(0, 10)))];
    const opcion = (sel) => el("select", {}, fechas.map((f) =>
      el("option", { value: f, ...(f === sel ? { selected: true } : {}) }, fechaLarga(f))));
    const selA = opcion(fechas[0]);
    const selB = opcion(fechas[fechas.length - 1]);
    const cajas = el("div", { class: "comp-fotos" });

    function pintar() {
      cajas.innerHTML = "";
      [selA.value, selB.value].forEach((f) => {
        const delDia = fotos.filter((x) => diaDe(x) === f).sort(ordenPose);
        const rev = revisionesDe(p.id).filter((r) => String(r.fecha).slice(0, 10) <= f).slice(-1)[0];
        cajas.appendChild(el("div", { class: "comp-col" }, [
          el("div", { class: "comp-cab" }, [
            el("b", {}, fechaLarga(f)),
            rev ? el("div", { class: "small muted" }, [
              rev.peso_kg != null ? fmt(rev.peso_kg, 1) + " kg" : null,
              rev.grasa_pct != null ? fmt(rev.grasa_pct, 1) + " % grasa" : null,
            ].filter(Boolean).join(" · ")) : null,
          ]),
          el("div", { class: "comp-tiras" }, delDia.map((x) => el("div", {}, [
            el("div", { class: "small muted", style: "margin-bottom:4px" }, poseDe(x).label),
            imagen(x, "comp-img"),
          ]))),
        ]));
      });
    }
    [selA, selB].forEach((s) => s.addEventListener("change", pintar));
    modal({
      title: "🔍 Comparar fotos", wide: true,
      body: el("div", {}, [
        el("div", { class: "row" }, [
          el("label", { class: "field" }, [el("span", {}, "Antes"), selA]),
          el("label", { class: "field" }, [el("span", {}, "Después"), selB]),
        ]),
        cajas,
      ]),
    });
    pintar();
  }

  function seccionFotos(p, recargar) {
    const fotos = fotosDe(p.id).slice().reverse();
    const cont = el("div", {});
    cont.appendChild(el("div", { class: "toolbar", style: "margin-top:22px" }, [
      el("div", { class: "grow side-ttl", style: "margin:0" }, "📷 Fotos de progreso"),
      fotos.length > 1 ? el("button", { class: "btn", onclick: () => comparar(p) }, "🔍 Comparar") : null,
      el("button", { class: "btn btn-primary", onclick: () => formFoto(p, recargar) }, "＋ Subir fotos"),
    ].filter(Boolean)));

    if (!fotos.length) {
      cont.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📷"),
        el("div", {}, "Todavía no hay fotos."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Una foto de frente, de perfil y de espalda en cada revisión enseña cambios que la báscula no ve."),
      ]));
      return cont;
    }

    // Agrupadas por día (de la más reciente a la más antigua) y dentro de cada día por pose
    const porFecha = [];
    fotos.forEach((f) => {
      const k = diaDe(f);
      const g = porFecha.find((x) => x.fecha === k) || (porFecha.push({ fecha: k, fotos: [] }), porFecha[porFecha.length - 1]);
      g.fotos.push(f);
    });
    porFecha.sort((a, b) => b.fecha.localeCompare(a.fecha));
    porFecha.forEach((g) => {
      g.fotos.sort(ordenPose);
      cont.appendChild(el("div", { class: "doc-sec" }, [
        el("span", { class: "doc-sec-ic" }, "📅"),
        el("span", {}, fechaLarga(g.fecha)),
        el("span", { class: "tag" }, String(g.fotos.length)),
        el("button", { class: "btn btn-sm", style: "margin-left:auto", onclick: () => formFoto(p, recargar, g.fecha) }, "＋ Añadir a este día"),
      ]));
      // Frente, perfil y espalda que falten ese día, listas para añadir con un toque
      const faltan = POSES.slice(0, 3).filter((o) => !g.fotos.some((f) => poseDe(f).key === o.key));
      cont.appendChild(el("div", { class: "foto-grid" }, g.fotos.map((f) => el("div", { class: "foto-card" }, [
        imagen(f),
        el("div", { class: "foto-pie" }, [
          el("span", { class: "grow small" }, poseDe(f).label),
          el("button", { class: "icon-btn", title: "Borrar la foto", onclick: () => {
            if (!confirm("¿Borrar esta foto?")) return;
            NP.store.deleteRegistro(f.id); toast("Foto borrada"); recargar();
          } }, "🗑"),
        ]),
        f.nota ? el("div", { class: "small muted", style: "padding:0 10px 10px" }, f.nota) : null,
      ])).concat(faltan.map((o) => huecoRapido(p, g.fecha, o, recargar)))));
    });
    return cont;
  }

  /* ================= Vista del nutricionista ================= */
  function nutri(view, pacienteId) {
    liberarUrls();
    const p = NP.store.getPaciente(pacienteId);
    if (!p) { NP.app.go("#/pacientes"); return; }
    const corto = p.nombre.split(" ")[0];
    NP.app.setTitle("Revisiones · " + p.nombre);
    const recargar = () => NP.app.route();

    view.appendChild(el("div", { class: "plan-head" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + p.id) }, "← Volver a " + corto),
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-primary", onclick: () => formRevision(p, null, recargar) }, "＋ Nueva revisión"),
    ]));
    if (!NP.store.registrosListos()) view.appendChild(avisoBaseDeDatos());

    const revs = revisionesDe(p.id);
    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "side-ttl" }, "📈 Progresión"),
      grafica(p),
      revs.length ? resumenCambio(revs) : null,
      notaGrasa(revs, true),
    ]));

    if (!revs.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📈"),
        el("div", {}, "Aún no has hecho ninguna revisión a " + corto + "."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Apunta el peso y los 7 pliegues y la app calcula sola su % de grasa."),
        el("button", { class: "btn", style: "margin-top:16px", onclick: () => formRevision(p, null, recargar) }, "＋ Primera revisión"),
      ]));
    } else {
      view.appendChild(el("div", { class: "side-ttl", style: "margin:22px 0 10px" }, "Historial de revisiones"));
      const lista = el("div", { class: "rev-lista" });
      revs.slice().reverse().forEach((r, i, arr) => lista.appendChild(tarjetaRevision(p, r, arr[i + 1], true, recargar)));
      view.appendChild(lista);
    }
    view.appendChild(seccionFotos(p, recargar));
  }

  /* ================= Vista del paciente ================= */
  function cliente(view) {
    liberarUrls();
    const p = NP.auth.pacienteActual();
    if (!p) return;
    NP.app.setTitle("Mi progreso");
    const recargar = () => NP.app.route();

    view.appendChild(el("div", { class: "plan-head" }, [
      el("div", { class: "grow side-ttl", style: "margin:0" }, "📈 Mi progresión"),
      el("button", { class: "btn btn-primary", onclick: () => formPesoPaciente(p, recargar) }, "⚖️ Anotar mi peso"),
    ]));

    const revs = revisionesDe(p.id);
    view.appendChild(el("div", { class: "panel" }, [
      grafica(p),
      revs.length ? resumenCambio(revs) : null,
      notaGrasa(revs, false),
    ]));

    if (!revs.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📈"),
        el("div", {}, "Todavía no hay datos que enseñar."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Anota tu peso o espera a tu próxima revisión: aquí verás cómo evolucionas."),
      ]));
    } else {
      view.appendChild(el("div", { class: "side-ttl", style: "margin:22px 0 10px" }, "Mis revisiones"));
      const lista = el("div", { class: "rev-lista" });
      revs.slice().reverse().forEach((r, i, arr) => lista.appendChild(tarjetaRevision(p, r, arr[i + 1], false, recargar)));
      view.appendChild(lista);
    }
    view.appendChild(seccionFotos(p, recargar));
  }

  /* ---------- Piezas sueltas ---------- */
  const kpi = (l, v) => el("div", { class: "kpi" }, [
    el("div", { class: "v" }, Array.isArray(v) ? v.filter(Boolean) : String(v)),
    el("div", { class: "l" }, l),
  ]);
  const kpiAcento = (l, v) => {
    const n = kpi(l, v);
    n.style.cssText = "border-color:rgba(95,208,166,.45);background:rgba(95,208,166,.10)";
    return n;
  };

  /** Cuánto ha cambiado desde la primera revisión */
  function resumenCambio(revs) {
    const conPeso = revs.filter((r) => r.peso_kg != null);
    const conGrasa = revs.filter((r) => r.grasa_pct != null);
    const partes = [];
    if (conPeso.length > 1) {
      const d = conPeso[conPeso.length - 1].peso_kg - conPeso[0].peso_kg;
      partes.push(`${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 1)} kg de peso`);
    }
    if (conGrasa.length > 1) {
      const d = conGrasa[conGrasa.length - 1].grasa_pct - conGrasa[0].grasa_pct;
      partes.push(`${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 1)} puntos de grasa`);
    }
    if (!partes.length) return null;
    return el("div", { class: "small muted", style: "margin-top:10px" },
      `Desde la primera revisión (${fechaLarga(revs[0].fecha)}): ` + partes.join(" · "));
  }

  const avisoBaseDeDatos = () => el("div", { class: "auth-error", style: "margin-bottom:14px" },
    "El seguimiento todavía no está activado en la base de datos. Abre Supabase → SQL Editor, " +
    "pega el archivo supabase/esquema.sql entero y pulsa «Run». Después recarga la app.");

  return { nutri, cliente, formRevision, formPesoPaciente, grafica, avisoBaseDeDatos, fechaLarga, hoyISO };
})();
