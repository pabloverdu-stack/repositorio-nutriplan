/* views/pacientes.js — lista de pacientes y detalle con sus planes */
NP.views = NP.views || {};
NP.views.pacientes = (function () {
  const { el, iniciales, modal, toast, fmt } = NP.util;

  const SEXOS = ["Mujer", "Hombre", "Otro"];

  /** Calculadora de calorías (Harris-Benedict, Mifflin o Katch-McArdle/Cunningham con el % de grasa) + actividad física.
   *  datosIniciales: {sexo, edad, peso, altura, grasa, actividad, objetivoCalc, formula}
   *  onUsar(kcalObjetivo, datos) al pulsar "Usar estas kcal". */
  function calculadoraKcal(datosIniciales, onUsar) {
    const C = NP.calorias;
    const d = datosIniciales || {};

    const sexoIni = C.normSexo(d.sexo);
    const fSexo = el("select", {}, [["mujer", "Mujer"], ["hombre", "Hombre"], ["indeterminado", "Sin especificar (promedio)"]].map(
      ([v, l]) => el("option", { value: v, ...(v === sexoIni ? { selected: true } : {}) }, l)));
    const fEdad = el("input", { type: "number", value: d.edad ?? "", min: 10, max: 110, placeholder: "años" });
    const fPeso = el("input", { type: "number", value: d.peso ?? "", min: 25, max: 300, step: 0.1, placeholder: "kg" });
    const fAlt = el("input", { type: "number", value: d.altura ?? "", min: 100, max: 230, step: 0.5, placeholder: "cm" });
    const fGrasa = el("input", { type: "number", value: d.grasa ?? "", min: 1, max: 69, step: 0.1, placeholder: "% (opcional)" });
    const fAct = el("select", {}, C.ACTIVIDAD.map((a) =>
      el("option", { value: a.key, ...(a.key === (d.actividad || "moderado") ? { selected: true } : {}) },
        `${a.label} (×${a.factor}) · ${a.desc}`)));
    const fObj = el("select", {}, C.OBJETIVOS.map((o) =>
      el("option", { value: o.key, ...(o.key === (d.objetivoCalc || "mantenimiento") ? { selected: true } : {}) },
        `${o.label} · ${o.desc}`)));
    const fForm = el("select", {}, Object.keys(C.FORMULAS).map((kf) =>
      el("option", { value: kf, ...(kf === (d.formula || (d.grasa ? "katch" : "hb_revisada")) ? { selected: true } : {}) },
        C.FORMULAS[kf].label + (C.FORMULAS[kf].grasa ? " · necesita el % de grasa" : ""))));

    const res = el("div", {});
    let ultimo = null;

    function recalcular() {
      const datos = {
        sexo: fSexo.value, edad: Number(fEdad.value), peso: Number(fPeso.value),
        altura: Number(fAlt.value), grasa: fGrasa.value === "" ? null : Number(fGrasa.value),
        actividad: fAct.value, objetivo: fObj.value, formula: fForm.value,
      };
      res.innerHTML = "";
      if (!datos.edad || !datos.peso || !datos.altura) {
        ultimo = null;
        res.appendChild(el("div", { class: "muted small" }, "Rellena edad, peso y altura para calcular."));
        return;
      }
      const r = C.calcular(datos);
      if (!r) {
        ultimo = null;
        res.appendChild(el("div", { class: "muted small" },
          "Esta fórmula calcula el gasto a partir de la masa magra: escribe el % de grasa corporal (de los pliegues o la báscula)."));
        return;
      }
      const mac = C.macros(r.objetivo, datos.peso, datos.objetivo);
      const bmi = C.imc(datos.peso, datos.altura);
      ultimo = { datos, r };
      const pct = r.ajuste === 0 ? "sin ajuste" : (r.ajuste > 0 ? "+" : "") + Math.round(r.ajuste * 100) + " %";
      res.appendChild(el("div", { class: "kpis" }, [
        el("div", { class: "kpi" }, [el("div", { class: "v", style: "font-size:19px" }, fmt(r.tmb)), el("div", { class: "l" }, "TMB basal")]),
        el("div", { class: "kpi" }, [el("div", { class: "v", style: "font-size:19px" }, fmt(r.get)), el("div", { class: "l" }, "Gasto total ×" + r.factor)]),
        el("div", { class: "kpi", style: "border-color:rgba(95,208,166,.45);background:rgba(95,208,166,.10)" }, [
          el("div", { class: "v", style: "font-size:24px" }, fmt(r.objetivo)), el("div", { class: "l" }, "Objetivo · " + pct)]),
      ]));
      res.appendChild(el("div", { class: "small muted", style: "margin:12px 0 6px" }, "Reparto de macros orientativo:"));
      if (NP.comp && NP.comp.macroBar) {
        res.appendChild(NP.comp.macroBar({ hidratos_g: mac.hidratos_g, proteinas_g: mac.proteinas_g, grasas_g: mac.grasas_g }));
      }
      res.appendChild(el("div", { class: "small muted", style: "margin-top:8px" },
        `Proteínas ${mac.proteinas_g} g (${mac.prot_g_kg} g/kg) · Hidratos ${mac.hidratos_g} g · Grasas ${mac.grasas_g} g` +
        (bmi ? ` · IMC ${bmi.valor} (${bmi.categoria})` : "") +
        (r.magra_kg != null ? ` · Masa magra ${fmt(r.magra_kg, 1)} kg` : "")));
      // Con el % de grasa se pueden comparar todas las fórmulas: si difieren mucho, conviene fijarse
      if (r.magra_kg != null) {
        const filas = Object.keys(C.FORMULAS).map((kf) => {
          const x = C.calcular(Object.assign({}, datos, { formula: kf }));
          return el("tr", { class: kf === datos.formula ? "sel" : "" }, [
            el("td", {}, C.FORMULAS[kf].label), el("td", {}, fmt(x.tmb)), el("td", {}, fmt(x.get)),
          ]);
        });
        res.appendChild(el("div", { class: "small muted", style: "margin:14px 0 6px" }, "Comparativa de fórmulas (kcal/día):"));
        res.appendChild(el("table", { class: "tabla-formulas" }, [
          el("thead", {}, el("tr", {}, [el("th", {}, "Fórmula"), el("th", {}, "TMB"), el("th", {}, "Gasto total")])),
          el("tbody", {}, filas),
        ]));
      }
      res.appendChild(el("div", { class: "small muted", style: "margin-top:10px;opacity:.75" },
        "Valores orientativos: la fórmula estima el gasto, ajústalo según la evolución real del paciente."));
    }
    [fSexo, fEdad, fPeso, fAlt, fGrasa, fAct, fObj, fForm].forEach((f) => {
      f.addEventListener("input", recalcular); f.addEventListener("change", recalcular);
    });

    const body = el("div", {}, [
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Sexo"), fSexo]),
        el("label", { class: "field" }, [el("span", {}, "Edad (años)"), fEdad]),
        el("label", { class: "field" }, [el("span", {}, "Peso (kg)"), fPeso]),
        el("label", { class: "field" }, [el("span", {}, "Altura (cm)"), fAlt]),
        el("label", { class: "field" }, [el("span", {}, "Grasa (%)"), fGrasa]),
      ]),
      el("label", { class: "field" }, [el("span", {}, "Actividad física"), fAct]),
      el("label", { class: "field" }, [el("span", {}, "Objetivo calórico"), fObj]),
      el("label", { class: "field" }, [el("span", {}, "Fórmula"), fForm]),
      el("hr", { style: "border:none;border-top:1px solid var(--line-soft);margin:14px 0" }),
      res,
    ]);
    const m = modal({
      title: "🧮 Calcular calorías", body, wide: true,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          if (!ultimo) { toast("Rellena edad, peso y altura"); return; }
          onUsar(ultimo.r.objetivo, ultimo.datos, ultimo.r); m.close();
        } }, "✓ Usar estas kcal"),
      ],
    });
    recalcular();
    return m;
  }

  function formPaciente(existing, onSave) {
    const p = existing || { nombre: "", objetivo: "Mantenimiento", kcal_objetivo: 2000, notas: "" };
    const fNombre = el("input", { value: p.nombre, placeholder: "Nombre y apellidos" });
    const fObj = el("select", {}, ["Pérdida de grasa", "Mantenimiento", "Ganancia muscular", "Rendimiento", "Salud general"].map(
      (o) => el("option", { value: o, ...(o === p.objetivo ? { selected: true } : {}) }, o)));
    const fKcal = el("input", { type: "number", value: p.kcal_objetivo, min: 800, max: 5000, step: 50 });
    const fSexo = el("select", {}, [el("option", { value: "" }, "—")].concat(
      SEXOS.map((o) => el("option", { value: o, ...(o === p.sexo ? { selected: true } : {}) }, o))));
    const fNac = el("input", { type: "date", value: p.fecha_nacimiento || "", max: hoyISO() });
    const lblEdad = el("span", { class: "small muted" }, textoEdad(p.fecha_nacimiento));
    fNac.addEventListener("change", () => { lblEdad.textContent = textoEdad(fNac.value); });
    const fPeso = el("input", { type: "number", value: p.peso_kg ?? "", min: 20, max: 350, step: 0.1, placeholder: "kg" });
    const fAltura = el("input", { type: "number", value: p.altura_cm ?? "", min: 100, max: 230, step: 0.5, placeholder: "cm" });
    const fGrasa = el("input", { type: "number", value: p.grasa_pct ?? "", min: 1, max: 70, step: 0.1, placeholder: "%" });
    const fMusculo = el("input", { type: "number", value: p.musculo_pct ?? "", min: 1, max: 80, step: 0.1, placeholder: "%" });
    const fPatologias = el("textarea", { rows: 2, placeholder: "Diabetes tipo 2, hipotiroidismo, celiaquía, HTA..." }, [p.patologias || ""]);
    const fNotas = el("textarea", { rows: 3, placeholder: "Alergias, preferencias, gustos, horarios..." }, [p.notas || ""]);
    const fTel = el("input", { value: p.telefono || "", placeholder: "+34 600 000 000" });
    const fEmail = el("input", { type: "email", value: p.email || "", placeholder: "paciente@email.com" });
    const fActividad = el("select", {}, NP.calorias.ACTIVIDAD.map((a) =>
      el("option", { value: a.key, ...(a.key === (p.actividad || "moderado") ? { selected: true } : {}) },
        `${a.label} (×${a.factor})`)));
    // Botón que abre la calculadora tomando los datos que haya ahora mismo en el formulario
    const btnCalc = el("button", { class: "btn", type: "button", onclick: () => {
      calculadoraKcal({
        sexo: fSexo.value || p.sexo,
        edad: NP.calorias.edadDe(fNac.value),
        peso: num(fPeso.value), altura: num(fAltura.value), grasa: num(fGrasa.value),
        actividad: fActividad.value,
        objetivoCalc: p.objetivo_calc, formula: p.formula,
      }, (kcal, datos) => {
        fKcal.value = kcal;
        fActividad.value = datos.actividad;
        p.objetivo_calc = datos.objetivo; p.formula = datos.formula;
        toast("Objetivo: " + fmt(kcal) + " kcal/día");
      });
    } }, "🧮 Calcular");
    const body = el("div", {}, [
      el("label", { class: "field" }, [el("span", {}, "Nombre"), fNombre]),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Sexo"), fSexo]),
        el("label", { class: "field" }, [
          el("span", {}, ["Fecha de nacimiento ", lblEdad]), fNac,
        ]),
      ]),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Peso (kg)"), fPeso]),
        el("label", { class: "field" }, [el("span", {}, "Altura (cm)"), fAltura]),
      ]),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Grasa corporal (%)"), fGrasa]),
        el("label", { class: "field" }, [el("span", {}, "Masa muscular (%)"), fMusculo]),
      ]),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Actividad física"), fActividad]),
        el("label", { class: "field" }, [el("span", {}, "Objetivo"), fObj]),
      ]),
      el("div", { class: "row", style: "align-items:flex-end" }, [
        el("label", { class: "field", style: "flex:1" }, [el("span", {}, "Kcal objetivo / día"), fKcal]),
        el("div", { style: "flex:0 0 auto;margin-bottom:12px" }, [btnCalc]),
      ]),
      el("label", { class: "field" }, [el("span", {}, "Patologías / diagnósticos"), fPatologias]),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Teléfono (WhatsApp)"), fTel]),
        el("label", { class: "field" }, [el("span", {}, "Email"), fEmail]),
      ]),
      el("label", { class: "field" }, [el("span", {}, "Notas"), fNotas]),
    ]);
    const m = modal({
      title: existing ? "Editar paciente" : "Nuevo paciente", body, wide: true,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            if (!fNombre.value.trim()) { toast("Pon un nombre"); return; }
            const saved = NP.store.savePaciente({
              ...p, nombre: fNombre.value.trim(), objetivo: fObj.value,
              kcal_objetivo: Number(fKcal.value) || 2000, notas: fNotas.value.trim(),
              telefono: fTel.value.trim(), email: fEmail.value.trim(),
              sexo: fSexo.value, fecha_nacimiento: fNac.value || "",
              peso_kg: num(fPeso.value), altura_cm: num(fAltura.value),
              grasa_pct: num(fGrasa.value), musculo_pct: num(fMusculo.value),
              patologias: fPatologias.value.trim(),
              actividad: fActividad.value,
              objetivo_calc: p.objetivo_calc || "", formula: p.formula || "",
            });
            m.close(); onSave && onSave(saved);
          },
        }, "Guardar"),
      ],
    });
  }

  function lista(view) {
    const pacientes = NP.store.getPacientes();
    const header = el("div", { class: "toolbar" }, [
      el("div", { class: "grow" }, [el("span", { class: "muted" }, `${pacientes.length} paciente(s)`)]),
      el("button", { class: "btn btn-primary", onclick: () => formPaciente(null, () => NP.app.go("#/pacientes")) }, "＋ Nuevo paciente"),
    ]);
    view.appendChild(header);

    if (!pacientes.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "👥"),
        el("div", {}, "Aún no tienes pacientes."),
        el("div", { class: "small muted", style: "margin-top:6px" }, "Crea el primero para empezar a planificar su mes."),
      ]));
      return;
    }
    const list = el("div", { class: "list" });
    pacientes.forEach((p) => {
      const nPlanes = NP.store.planesDe(p.id).length;
      list.appendChild(el("div", { class: "list-item", onclick: () => NP.app.go("#/paciente/" + p.id) }, [
        el("div", { class: "avatar" }, iniciales(p.nombre)),
        el("div", { class: "grow" }, [
          el("div", { class: "name" }, p.nombre),
          el("div", { class: "small muted" }, resumenPersonal(p).concat([`${nPlanes} plan(es)`]).join(" · ")),
        ]),
        p.patologias ? el("span", { class: "pill", title: p.patologias }, "⚕️") : null,
        NP.auth.cuentaDePaciente(p.id)
          ? el("span", { class: "pill accent", title: "El paciente ya tiene su cuenta y ve sus menús" }, "🔑 con acceso")
          : el("span", { class: "pill", title: "Todavía no ha creado su cuenta de paciente" }, "sin acceso"),
        (function () { const n = NP.store.noLeidos(p.id, "nutri");
          return n ? el("span", { class: "pill aviso", title: "Mensajes sin leer" }, "💬 " + n) : null; })(),
        el("span", { class: "pill accent" }, "Abrir →"),
      ]));
    });
    view.appendChild(list);
  }

  function detalle(view, id) {
    const p = NP.store.getPaciente(id);
    if (!p) { NP.app.go("#/pacientes"); return; }
    NP.app.setTitle(p.nombre);

    const planes = NP.store.planesDe(p.id);
    view.appendChild(el("div", { class: "toolbar" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/pacientes") }, "← Pacientes"),
      el("div", { class: "grow" }),
      el("button", { class: "btn", onclick: () => formPaciente(p, () => NP.app.go("#/paciente/" + p.id)) }, "Editar"),
      el("button", { class: "btn", onclick: () => accesoPaciente(p) }, "🔑 Acceso del paciente"),
      el("button", { class: "btn", onclick: () => NP.app.go("#/mensajes/" + p.id) },
        "💬 Mensajes" + (NP.store.noLeidos(p.id, "nutri") ? " (" + NP.store.noLeidos(p.id, "nutri") + ")" : "")),
      el("button", { class: "btn btn-primary", onclick: () => crearPlan(p) }, "＋ Nuevo plan"),
    ]));

    const bmi = imc(p);
    const kgGrasa = kgDe(p.grasa_pct, p.peso_kg);
    const kgMusculo = kgDe(p.musculo_pct, p.peso_kg);
    const a = edad(p.fecha_nacimiento);

    view.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "kpis" }, [
        kpiTexto("Objetivo", p.objetivo),
        kpi("Kcal/día", fmt(p.kcal_objetivo)),
        a != null ? kpi("Edad", a + " años") : null,
        p.sexo ? kpi("Sexo", p.sexo) : null,
        p.peso_kg != null ? kpi("Peso", fmt(p.peso_kg, 1) + " kg") : null,
        p.altura_cm != null ? kpi("Altura", fmt(p.altura_cm, 0) + " cm") : null,
        bmi != null ? kpi("IMC · " + imcEtiqueta(bmi), fmt(bmi, 1)) : null,
        p.grasa_pct != null ? kpi(kgGrasa != null ? "Grasa · " + fmt(kgGrasa, 1) + " kg" : "Grasa corporal", fmt(p.grasa_pct, 1) + " %") : null,
        p.musculo_pct != null ? kpi(kgMusculo != null ? "Músculo · " + fmt(kgMusculo, 1) + " kg" : "Masa muscular", fmt(p.musculo_pct, 1) + " %") : null,
        kpi("Planes", planes.length),
      ].filter(Boolean)),
      p.fecha_nacimiento ? el("div", { class: "small muted", style: "margin-top:10px" }, "🎂 Nacimiento: " + fechaCorta(p.fecha_nacimiento)) : null,
      p.patologias ? el("div", { class: "small", style: "margin-top:10px" }, "⚕️ Patologías: " + p.patologias) : null,
      p.notas ? el("div", { class: "small muted", style: "margin-top:10px" }, "📝 " + p.notas) : null,
    ]));

    view.appendChild(seccionesDe(p));
    view.appendChild(progresoDe(p));

    const cont = el("div", { style: "margin-top:16px" });
    if (!planes.length) {
      cont.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🗓️"),
        el("div", {}, "Sin planes todavía."),
        el("div", { class: "small muted", style: "margin-top:6px" }, "Un plan es una semana que se repite durante el mes."),
      ]));
    } else {
      const list = el("div", { class: "list" });
      planes.forEach((pl) => {
        const menu = NP.esMenu(pl);
        const ruta = (menu ? "#/menu/" : "#/plan/") + pl.id;
        list.appendChild(el("div", { class: "list-item" }, [
          el("div", { class: "avatar" }, menu ? "🍽️" : "🗓️"),
          el("div", { class: "grow", onclick: () => NP.app.go(ruta) }, [
            el("div", { class: "name" }, pl.nombre),
            el("div", { class: "small muted" }, menu
              ? NP.views.menu.resumen(pl)
              : resumenPlan(pl) + " · " + fmt(mediaKcal(pl)) + " kcal/día"),
          ]),
          el("span", { class: "pill" }, menu ? "Por opciones" : "Semanal"),
          el("button", { class: "btn btn-sm", onclick: () => NP.app.go(ruta) }, "Abrir"),
          el("button", { class: "btn btn-sm", onclick: () => { duplicar(pl); NP.app.go("#/paciente/" + p.id); } }, "Duplicar"),
          el("button", { class: "btn btn-sm btn-danger", onclick: () => { if (confirm("¿Borrar este plan?")) { NP.store.deletePlan(pl.id); NP.app.go("#/paciente/" + p.id); } } }, "🗑"),
        ]));
      });
      cont.appendChild(list);
    }
    view.appendChild(cont);
  }

  /* Accesos al seguimiento del paciente: revisiones, entrenamiento, citas... */
  function seccionesDe(p) {
    const revs = NP.store.registrosDe(p.id, "revision");
    const rutina = NP.views.entreno.rutinaActiva(p.id);
    const sesiones = NP.store.registrosDe(p.id, "actividad").length;
    const proxima = NP.store.registrosDe(p.id, "cita").filter((c) => String(c.fecha) >= new Date().toISOString().slice(0, 10))[0];
    const alt = NP.store.registrosDe(p.id, "alternativa").length;
    const docs = NP.store.documentosDe(p.id).length;
    const fotos = NP.store.registrosDe(p.id, "foto").length;

    const tarjeta = (ic, titulo, detalle, hash) =>
      el("button", { class: "sec-card", onclick: () => NP.app.go(hash) }, [
        el("span", { class: "sec-ic" }, ic),
        el("span", { class: "grow" }, [
          el("span", { class: "sec-nm" }, titulo),
          el("span", { class: "sec-sub" }, detalle),
        ]),
      ]);

    return el("div", { class: "sec-grid" }, [
      tarjeta("📈", "Revisiones", revs.length
        ? revs.length + " revisión(es)" + (fotos ? " · " + fotos + " foto(s)" : "") +
          " · última " + NP.views.revisiones.fechaLarga(revs[revs.length - 1].fecha)
        : "Peso, pliegues y fotos", "#/revisiones/" + p.id),
      tarjeta("🏋️", "Entrenamiento", rutina
        ? rutina.nombre + " · " + sesiones + " sesión(es) apuntadas"
        : "Sin rutina todavía", "#/entreno/" + p.id),
      tarjeta("🗓️", "Citas", proxima
        ? "Próxima: " + NP.views.revisiones.fechaLarga(proxima.fecha) + " " + String(proxima.fecha).slice(11, 16)
        : "Ninguna puesta", "#/agenda/" + p.id),
      tarjeta("🥗", "Recetas y alternativas", alt ? alt + " guardada(s)" : "Cambios de alimentos", "#/alternativas/" + p.id),
      tarjeta("📂", "Documentos", docs ? docs + " PDF enviado(s)" : "Rutinas, guías y PDF", "#/documentos/" + p.id),
    ]);
  }

  /* Gráfica de peso y grasa, si ya hay revisiones que dibujar */
  function progresoDe(p) {
    const revs = NP.store.registrosDe(p.id, "revision");
    if (revs.length < 2) return el("div", {});
    return el("div", { class: "panel", style: "margin-top:16px" }, [
      el("div", { class: "row", style: "align-items:center;margin-bottom:6px" }, [
        el("div", { class: "grow side-ttl", style: "margin:0" }, "📈 Progresión"),
        el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => NP.app.go("#/revisiones/" + p.id) }, "Ver revisiones"),
      ]),
      NP.views.revisiones.grafica(p),
    ]);
  }

  /* Acceso del paciente: código con el que crea su cuenta y entra a ver sus menús */
  function accesoPaciente(p) {
    const cuenta = NP.auth.cuentaDePaciente(p.id);
    const codigo = NP.store.codigoAcceso(p.id);
    const codigoEl = el("div", { class: "codigo-acceso" }, codigo);
    const nombreCorto = p.nombre.split(" ")[0];
    const texto = `Hola ${nombreCorto}, ya puedes ver tus menús y escribirme desde la app.\n\n` +
      `Entra, elige "Soy paciente" > "Es mi primera vez" y usa este código de acceso: ${codigo}`;

    const estado = cuenta
      ? el("div", { class: "nota-pdf" }, [
          el("b", {}, "✓ Ya tiene cuenta: "), cuenta.email,
          el("div", { class: "small muted", style: "margin-top:6px" },
            "Entra con su email y su contraseña. El código solo hace falta para crearla."),
        ])
      : el("div", { class: "nota-pdf" }, [
          el("b", {}, "Todavía no ha creado su cuenta. "),
          "Pásale el código: en la pantalla de entrada elige «Soy paciente» y luego «Es mi primera vez».",
        ]);

    const body = el("div", {}, [
      estado,
      el("div", { class: "small muted", style: "margin:14px 0 6px" }, "Código de acceso de " + nombreCorto + ":"),
      codigoEl,
      el("div", { class: "small muted", style: "margin-top:14px;line-height:1.5" },
        "Con su cuenta el paciente ve sus menús de la semana (solo lectura), las recetas con sus " +
        "gramos y elaboración, los PDF que le mandes (rutinas, ideas de recetas...) y puede " +
        "escribirte por el chat. No ve a tus otros pacientes."),
    ]);

    const m = modal({
      title: "🔑 Acceso de " + nombreCorto, body,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cerrar"),
        el("button", { class: "btn btn-danger", title: "Genera un código nuevo; el anterior deja de valer",
          onclick: () => {
            if (!confirm("¿Generar un código nuevo? El anterior dejará de funcionar.")) return;
            codigoEl.textContent = NP.store.regenerarCodigo(p.id);
            toast("Código nuevo generado");
          } }, "↻ Nuevo código"),
        cuenta ? el("button", { class: "btn btn-danger", onclick: () => {
          if (!confirm("¿Quitarle el acceso? Se borra su cuenta y tendrá que crearla otra vez con un código.")) return;
          NP.auth.borrarCuentaDePaciente(p.id);
          m.close(); toast("Acceso retirado"); NP.app.go("#/paciente/" + p.id);
        } }, "Quitar acceso") : null,
        el("button", { class: "btn", onclick: () => { navigator.clipboard.writeText(texto); toast("Instrucciones copiadas"); } }, "📋 Copiar aviso"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const tel = (p.telefono || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
          if (!tel) { toast("Este paciente no tiene teléfono. Edítalo para añadirlo."); return; }
          window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank");
        } }, "🟢 Enviar por WhatsApp"),
      ].filter(Boolean),
    });
  }

  function crearPlan(p) {
    const mes = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const mesTit = mes.charAt(0).toUpperCase() + mes.slice(1);
    const inp = el("input", { value: "Plan " + mesTit });
    let tipo = "semanal";

    // Dos formas de trabajar: la rejilla de 7 días, o varias opciones por comida
    const opciones = [
      { key: "semanal", ic: "🗓️", tit: "Semana completa", tx: "Una semana con su menú para cada día, que se repite durante el mes. Calcula las kcal y los macros de cada comida." },
      { key: "opciones", ic: "🍽️", tit: "Menú por opciones", tx: "Días de entreno y de descanso, y en cada comida varias opciones equivalentes entre las que el paciente elige cada día." },
    ];
    const tarjetas = opciones.map((o) => {
      const card = el("button", { class: "rol-card" + (o.key === tipo ? " elegida" : ""), type: "button", onclick: () => {
        tipo = o.key;
        tarjetas.forEach((c) => c.classList.remove("elegida"));
        card.classList.add("elegida");
        inp.value = tipo === "opciones" ? "Programa nutricional de " + p.nombre.split(" ")[0] : "Plan " + mesTit;
      } }, [
        el("div", { class: "rol-ic" }, o.ic),
        el("div", { class: "rol-tit" }, o.tit),
        el("div", { class: "rol-tx" }, o.tx),
      ]);
      return card;
    });

    const body = el("div", {}, [
      el("div", { class: "small muted", style: "margin-bottom:8px" }, "¿Cómo quieres montar este plan?"),
      el("div", { class: "auth-roles" }, tarjetas),
      el("label", { class: "field", style: "margin-top:14px" }, [el("span", {}, "Nombre del plan"), inp]),
    ]);
    const m = modal({
      title: "Nuevo plan", body, wide: true,
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", {
          class: "btn btn-primary", onclick: () => {
            const nombre = inp.value.trim() || "Plan";
            const pl = NP.store.savePlan(tipo === "opciones" ? NP.nuevoMenu(p.id, nombre) : NP.nuevoPlan(p.id, nombre));
            m.close(); NP.app.go((tipo === "opciones" ? "#/menu/" : "#/plan/") + pl.id);
          },
        }, "Crear plan"),
      ],
    });
  }
  function duplicar(pl) {
    const copia = JSON.parse(JSON.stringify(pl));
    delete copia.id; copia.nombre = pl.nombre + " (copia)";
    NP.store.savePlan(copia); NP.util.toast("Plan duplicado");
  }

  const comidasDe = (pl) => (Array.isArray(pl.comidas) ? pl.comidas : NP.COMIDAS);
  // Cada hueco puede llevar varios platos: NP.slot resuelve la lista y suma sus kcal
  const slotDe = (pl, d, c) => (pl.dias[d.key] && pl.dias[d.key][c.key]) || null;
  const resumenPlan = (pl) => {
    let n = 0;
    // Solo las comidas que resuelven, igual que la rejilla del plan
    NP.DIAS.forEach((d) => comidasDe(pl).forEach((c) => { if (NP.slot.comidas(slotDe(pl, d, c), c.tipo).length) n++; }));
    return `${n} comidas asignadas`;
  };
  const mediaKcal = (pl) => {
    let tot = 0;
    NP.DIAS.forEach((d) => comidasDe(pl).forEach((c) => { tot += NP.slot.kcal(slotDe(pl, d, c), c.tipo); }));
    return tot / 7;
  };
  const kpi = (l, v) => el("div", { class: "kpi" }, [el("div", { class: "v" }, String(v)), el("div", { class: "l" }, l)]);
  // KPI con texto (p. ej. "Mantenimiento"): letra más pequeña para que no se salga de la casilla
  const kpiTexto = (l, v) => el("div", { class: "kpi" }, [el("div", { class: "v v-texto" }, String(v)), el("div", { class: "l" }, l)]);

  // Línea resumen para la lista: solo los datos que el paciente tenga rellenos
  function resumenPersonal(p) {
    const out = [];
    const a = edad(p.fecha_nacimiento);
    const bio = [p.sexo, a != null ? a + " a" : null].filter(Boolean).join(" ");
    if (bio) out.push(bio);
    if (p.peso_kg != null) out.push(fmt(p.peso_kg, 1) + " kg");
    if (p.grasa_pct != null) out.push(fmt(p.grasa_pct, 1) + "% grasa");
    if (p.musculo_pct != null) out.push(fmt(p.musculo_pct, 1) + "% músculo");
    out.push(p.objetivo, fmt(p.kcal_objetivo) + " kcal/día");
    return out;
  }

  // ---- Datos personales: helpers ----
  // Campo numérico opcional: "" -> null (para no guardar ceros falsos)
  const num = (v) => { const s = String(v).trim(); if (s === "") return null; const n = Number(s); return isNaN(n) ? null : n; };
  const hoyISO = () => new Date().toISOString().slice(0, 10);

  // Edad en años cumplidos a partir de una fecha ISO (yyyy-mm-dd)
  function edad(iso) {
    if (!iso) return null;
    const n = new Date(iso + "T00:00:00");
    if (isNaN(n)) return null;
    const h = new Date();
    let a = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
    return a >= 0 && a < 130 ? a : null;
  }
  const textoEdad = (iso) => { const a = edad(iso); return a == null ? "" : `(${a} años)`; };
  const fechaCorta = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? "—" : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };
  // IMC = peso(kg) / altura(m)^2
  const imc = (p) => (p.peso_kg && p.altura_cm ? p.peso_kg / Math.pow(p.altura_cm / 100, 2) : null);
  const imcEtiqueta = (v) =>
    v == null ? "" : v < 18.5 ? "bajo peso" : v < 25 ? "normopeso" : v < 30 ? "sobrepeso" : "obesidad";
  // Kg derivados de los porcentajes de composición corporal
  const kgDe = (pct, peso) => (pct != null && peso ? (pct / 100) * peso : null);

  return { lista, detalle };
})();
