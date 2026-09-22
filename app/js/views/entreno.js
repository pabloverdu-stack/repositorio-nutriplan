/* views/entreno.js — entrenamiento.
   El nutricionista arma la rutina del paciente (días y ejercicios con sus series,
   repeticiones y peso) y el paciente la ve en «Mi entreno», donde además apunta
   lo que ha levantado en cada sesión. Con ese registro se dibuja la progresión
   de cargas de cada ejercicio. */
NP.views = NP.views || {};

/* Catálogo de ejercicios para elegir rápido; siempre se puede escribir otro a mano.
   Cada ejercicio va en sus variantes por material (barra, mancuernas, máquina, polea,
   multipower...), no por modelo de máquina: cada gimnasio tiene las suyas y así el
   nutricionista elige la que haya donde entrena el paciente. */
NP.EJERCICIOS = [
  { grupo: "Pecho", ic: "🏋️", lista: [
    "Press banca con barra", "Press banca con mancuernas", "Press banca en multipower",
    "Press inclinado con barra", "Press inclinado con mancuernas", "Press inclinado en multipower",
    "Press declinado con barra", "Press declinado con mancuernas", "Press declinado en multipower",
    "Press de pecho en máquina", "Press inclinado en máquina", "Press declinado en máquina",
    "Press de pecho a una mano en máquina", "Press de suelo con barra (floor press)", "Press de suelo con mancuernas",
    "Press con mancuernas agarre neutro (squeeze press)", "Press landmine a una mano", "Press de pecho en polea de pie",
    "Press de pecho con banda elástica",
    "Aperturas con mancuernas", "Aperturas inclinadas con mancuernas", "Aperturas en máquina (contractor / pec deck)",
    "Cruce de poleas alto", "Cruce de poleas medio", "Cruce de poleas bajo", "Aperturas en polea en banco inclinado",
    "Aperturas a una mano en polea", "Pull-over con mancuerna",
    "Fondos en paralelas (pecho)", "Fondos asistidos en máquina",
    "Flexiones", "Flexiones inclinadas (manos elevadas)", "Flexiones declinadas (pies elevados)",
    "Flexiones con lastre", "Flexiones en anillas", "Flexiones con banda elástica",
  ] },
  { grupo: "Espalda", ic: "🔙", lista: [
    "Dominadas pronas", "Dominadas supinas", "Dominadas agarre neutro", "Dominadas lastradas",
    "Dominadas asistidas en máquina", "Dominadas asistidas con banda elástica", "Dominadas negativas",
    "Jalón al pecho agarre abierto", "Jalón al pecho agarre estrecho neutro", "Jalón al pecho agarre supino",
    "Jalón unilateral en polea", "Jalón en máquina", "Jalón con brazos rectos en polea (pull-over en polea)",
    "Remo con barra", "Remo con barra agarre supino", "Remo Pendlay con barra", "Remo en barra T", "Remo en barra T con pecho apoyado",
    "Remo landmine", "Remo Meadows con barra (landmine)", "Remo en multipower",
    "Remo con mancuerna a una mano", "Remo con mancuernas con pecho apoyado en banco inclinado", "Remo Kroc con mancuerna",
    "Remo en polea baja agarre estrecho", "Remo en polea baja agarre abierto", "Remo unilateral en polea",
    "Remo en máquina", "Remo en máquina con pecho apoyado", "Remo alto en máquina", "Remo unilateral en máquina",
    "Remo invertido (australiano)", "Remo en TRX", "Remo con banda elástica",
    "Pull-over con mancuerna (dorsal)", "Pull-over en máquina",
    "Hiperextensiones lumbares", "Hiperextensiones en banco a 45°", "Extensión lumbar en máquina", "Superman",
  ] },
  { grupo: "Hombro", ic: "🤸", lista: [
    "Press militar con barra de pie", "Press militar con barra sentado", "Press militar en multipower",
    "Press de hombro con mancuernas sentado", "Press de hombro con mancuernas de pie", "Press Arnold con mancuernas",
    "Press de hombro en máquina", "Press de hombro a una mano en máquina", "Press landmine de hombro",
    "Press con kettlebell", "Push press con barra", "Press en pino (handstand push-up)",
    "Elevaciones laterales con mancuernas", "Elevaciones laterales sentado con mancuernas", "Elevaciones laterales en polea",
    "Elevaciones laterales en máquina", "Elevaciones laterales inclinado con mancuerna", "Elevaciones laterales con banda elástica",
    "Elevaciones frontales con mancuernas", "Elevaciones frontales con disco", "Elevaciones frontales con barra",
    "Elevaciones frontales en polea",
    "Pájaros con mancuernas", "Pájaros en polea (cruce inverso)", "Pájaros en máquina (contractor invertido)",
    "Pájaros con mancuernas con pecho apoyado en banco inclinado",
    "Face pull en polea", "Face pull con banda elástica", "Pull-apart con banda elástica",
    "Remo al mentón con barra", "Remo al mentón con mancuernas", "Remo al mentón en polea",
    "Elevación en Y con mancuernas en banco inclinado", "Rotación externa en polea", "Rotación externa con mancuerna", "Rotación interna en polea",
  ] },
  { grupo: "Trapecio", ic: "🔺", lista: [
    "Encogimientos con barra", "Encogimientos con mancuernas", "Encogimientos en multipower",
    "Encogimientos en máquina", "Encogimientos en polea", "Encogimientos con barra hexagonal",
    "Paseo del granjero con mancuernas",
  ] },
  { grupo: "Bíceps", ic: "💪", lista: [
    "Curl con barra recta", "Curl con barra Z", "Curl con mancuernas alterno", "Curl con mancuernas simultáneo",
    "Curl martillo con mancuernas", "Curl martillo en polea con cuerda", "Curl inclinado con mancuernas",
    "Curl concentrado con mancuerna", "Curl predicador con barra Z (banco Scott)", "Curl predicador con mancuerna",
    "Curl predicador en máquina", "Curl de bíceps en máquina", "Curl en polea baja con barra", "Curl a una mano en polea baja",
    "Curl en polea alta (doble bíceps)", "Curl bayesiano en polea", "Curl araña con barra Z (spider curl)",
    "Curl araña con mancuernas", "Curl Zottman con mancuernas", "Curl de arrastre con barra (drag curl)",
    "Curl con banda elástica", "Dominadas supinas estrechas (bíceps)",
  ] },
  { grupo: "Tríceps", ic: "💪", lista: [
    "Extensión de tríceps en polea con cuerda", "Extensión de tríceps en polea con barra", "Extensión de tríceps en polea con barra V",
    "Extensión de tríceps a una mano en polea", "Extensión de tríceps en polea agarre supino",
    "Extensión por encima de la cabeza en polea", "Extensión por encima de la cabeza con mancuerna",
    "Extensión por encima de la cabeza a una mano con mancuerna",
    "Press francés con barra Z", "Press francés con mancuernas", "Press francés en polea",
    "Patada de tríceps con mancuerna", "Patada de tríceps en polea",
    "Press banca agarre cerrado con barra", "Press cerrado en multipower", "Press JM con barra",
    "Extensión de tríceps en máquina", "Fondos en máquina", "Fondos en paralelas (tríceps)", "Fondos en banco",
    "Flexiones diamante", "Extensión de tríceps con banda elástica",
  ] },
  { grupo: "Antebrazo", ic: "✊", lista: [
    "Curl de muñeca con barra", "Curl de muñeca invertido con barra", "Curl de muñeca con mancuerna",
    "Curl invertido con barra Z", "Rodillo de muñeca", "Colgado pasivo (dead hang)", "Agarre con disco (pinza)",
  ] },
  { grupo: "Cuádriceps", ic: "🦵", lista: [
    "Sentadilla trasera con barra", "Sentadilla frontal con barra", "Sentadilla en multipower", "Sentadilla Zercher con barra",
    "Sentadilla hack en máquina", "Sentadilla hack inversa en máquina", "Sentadilla péndulo en máquina",
    "Sentadilla en máquina con cinturón (belt squat)", "Sentadilla landmine",
    "Sentadilla goblet con mancuerna", "Sentadilla goblet con kettlebell", "Sentadilla con peso corporal",
    "Sentadilla con salto", "Sentadilla sissy", "Sentadilla a una pierna (pistol)",
    "Sentadilla búlgara con mancuernas", "Sentadilla búlgara con barra", "Sentadilla búlgara en multipower",
    "Prensa de piernas 45°", "Prensa horizontal en máquina", "Prensa vertical", "Prensa a una pierna",
    "Extensión de cuádriceps en máquina", "Extensión de cuádriceps a una pierna en máquina",
    "Zancadas con mancuernas", "Zancadas con barra", "Zancadas en multipower", "Zancadas caminando con mancuernas",
    "Zancadas inversas con mancuernas", "Zancadas laterales", "Zancadas con peso corporal",
    "Subidas al cajón con mancuernas (step-up)", "Subidas al cajón con barra", "Sentadilla con banda elástica",
  ] },
  { grupo: "Femoral y cadena posterior", ic: "🦿", lista: [
    "Peso muerto convencional con barra", "Peso muerto sumo con barra", "Peso muerto con barra hexagonal",
    "Peso muerto con mancuernas", "Peso muerto con kettlebell", "Rack pull con barra",
    "Peso muerto rumano con barra", "Peso muerto rumano con mancuernas", "Peso muerto rumano en multipower",
    "Peso muerto rumano a una pierna con mancuerna", "Peso muerto piernas rígidas con barra",
    "Curl femoral tumbado en máquina", "Curl femoral sentado en máquina", "Curl femoral de pie a una pierna en máquina",
    "Curl femoral en polea", "Curl femoral con fitball", "Curl nórdico", "Curl femoral con banda elástica",
    "Buenos días con barra", "Buenos días en multipower", "Glute-ham raise (GHR)",
    "Pull-through en polea", "Swing con kettlebell",
  ] },
  { grupo: "Glúteo", ic: "🍑", lista: [
    "Hip thrust con barra", "Hip thrust en máquina", "Hip thrust en multipower", "Hip thrust con mancuerna",
    "Hip thrust a una pierna", "Hip thrust con banda elástica",
    "Puente de glúteo en suelo", "Puente de glúteo con barra", "Puente de glúteo a una pierna", "Frog pump",
    "Patada de glúteo en polea", "Patada de glúteo en máquina", "Patada de glúteo en multipower",
    "Patada de glúteo en cuadrupedia con banda elástica",
    "Abducción de cadera en máquina", "Abducción de cadera en polea", "Abducción de cadera con banda elástica",
    "Monster walk con banda elástica", "Sentadilla sumo con mancuerna", "Sentadilla sumo con kettlebell",
    "Hiperextensiones enfocadas a glúteo", "Peso muerto sumo con mancuerna",
  ] },
  { grupo: "Aductores", ic: "↔️", lista: [
    "Aducción de cadera en máquina", "Aducción de cadera en polea", "Aducción con banda elástica",
    "Plancha Copenhague", "Sentadilla cosaca",
  ] },
  { grupo: "Gemelo y tibial", ic: "🦶", lista: [
    "Elevación de gemelos de pie en máquina", "Elevación de gemelos sentado en máquina", "Elevación de gemelos en prensa",
    "Elevación de gemelos en multipower", "Elevación de gemelos con mancuerna a una pierna", "Elevación de gemelos en escalón",
    "Elevación de gemelos en máquina tipo burro", "Elevación de tibial",
  ] },
  { grupo: "Core", ic: "🧘", lista: [
    "Plancha frontal", "Plancha lateral", "Plancha con toque de hombro", "Plancha con lastre",
    "Crunch", "Crunch en polea (arrodillado)", "Crunch en máquina", "Crunch inverso", "Crunch en banco declinado", "Crunch bicicleta",
    "Elevación de piernas colgado", "Elevación de rodillas colgado", "Elevación de piernas en paralelas (silla romana)",
    "Elevación de piernas tumbado", "Rueda abdominal", "Rollout con fitball",
    "Pallof press en polea", "Pallof press con banda elástica", "Leñador en polea de arriba abajo", "Leñador en polea de abajo arriba",
    "Giro ruso con disco", "Rotación de tronco en máquina", "Oblicuos en banco romano",
    "Dead bug", "Bird dog", "Hollow hold", "V-ups", "Toes to bar", "L-sit", "Dragon flag", "Mountain climbers",
    "Paseo de maleta con mancuerna (suitcase carry)",
  ] },
  { grupo: "Funcional y potencia", ic: "⚡", lista: [
    "Cargada de potencia con barra (power clean)", "Arrancada con barra (snatch)", "Dos tiempos con barra (clean & jerk)",
    "Thruster con barra", "Thruster con mancuernas", "Swing con kettlebell a una mano", "Cargada con kettlebell",
    "Arrancada con kettlebell", "Turkish get-up con kettlebell", "Saltos al cajón", "Burpees",
    "Wall ball con balón medicinal", "Lanzamiento de balón medicinal", "Slam ball",
    "Empuje de trineo", "Arrastre de trineo", "Cuerdas de batalla (battle ropes)", "Paseo del granjero con kettlebell",
    "Circuito en TRX",
  ] },
  { grupo: "Cardio", ic: "🏃", lista: [
    "Caminar", "Caminar en cinta inclinada", "Correr", "Correr en cinta", "Bicicleta estática", "Bicicleta de spinning",
    "Bicicleta reclinada", "Bicicleta de aire (air bike)", "Bicicleta en exterior", "Elíptica", "Remo ergómetro", "SkiErg",
    "Escaladora (stairmaster)", "Stepper", "Comba", "Natación", "HIIT", "Circuito metabólico", "Jumping jacks",
    "Boxeo en saco", "Senderismo",
  ] },
  { grupo: "Movilidad y estiramientos", ic: "🧎", lista: [
    "Movilidad de cadera 90/90", "Movilidad torácica", "Gato-camello", "Dislocaciones de hombro con pica",
    "Estiramiento de isquios", "Estiramiento de flexores de cadera", "Estiramiento de cuádriceps", "Estiramiento de pectoral",
    "Movilidad de tobillo", "Liberación con foam roller", "Yoga", "Pilates",
  ] },
];

/* Material de cada ejercicio, deducido de su nombre, para filtrar por lo que hay en el gimnasio.
   Un ejercicio puede tener más de uno (p. ej. «Subidas al cajón con mancuernas»). */
NP.MATERIALES = [
  { key: "barra",     label: "Barra",          re: /\bbarra\b|landmine|rack pull|power clean|snatch|clean & jerk|press jm/ },
  { key: "mancuerna", label: "Mancuernas",     re: /mancuerna/ },
  { key: "maquina",   label: "Máquina",        re: /máquina|prensa|contractor|pec deck|banco scott|belt squat/ },
  { key: "polea",     label: "Polea",          re: /polea|jalón(?! en máquina)|cruce de poleas/ },
  { key: "multi",     label: "Multipower",     re: /multipower/ },
  { key: "kettle",    label: "Kettlebell",     re: /kettlebell/ },
  { key: "banda",     label: "Bandas / TRX",   re: /banda elástica|trx/ },
];
NP.materialesDe = (function () {
  // Grupos sin filtro de material (no tiene sentido "peso corporal" en cardio o movilidad)
  const SIN_MATERIAL = ["Cardio", "Movilidad y estiramientos"];
  // Otro material (disco, balón, trineo...): si no casa con ninguno de arriba, tampoco es peso corporal
  const OTRO = /disco|balón|slam ball|trineo|cuerdas|fitball|rueda abdominal|rodillo|foam|pica/;
  return function (nombre, grupo) {
    const n = String(nombre).toLowerCase();
    const tags = NP.MATERIALES.filter((m) => m.re.test(n)).map((m) => m.key);
    if (!tags.length && SIN_MATERIAL.indexOf(grupo) < 0 && !OTRO.test(n)) tags.push("corporal");
    return tags;
  };
})();

NP.views.entreno = (function () {
  const { el, fmt, modal, toast, sinAcentos } = NP.util;

  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const fechaLarga = (iso) => NP.views.revisiones.fechaLarga(iso);
  const ms = (iso) => new Date(String(iso).slice(0, 10) + "T00:00:00").getTime();
  const num = (v) => { const s = String(v).trim(); if (s === "") return null; const n = Number(s); return isNaN(n) ? null : n; };

  const rutinasDe = (id) => NP.store.registrosDe(id, "rutina");
  const sesionesDe = (id) => NP.store.registrosDe(id, "actividad");
  const rutinaActiva = (id) => { const l = rutinasDe(id); return l.find((r) => r.activa) || l[l.length - 1] || null; };
  const nEjercicios = (rt) => (rt.dias || []).reduce((s, d) => s + (d.ejercicios || []).length, 0);
  /** Kg movidos en una sesión (series × repeticiones × peso) */
  const volumen = (s) => (s.ejercicios || []).reduce((t, e) =>
    t + (e.series || []).reduce((x, se) => x + (Number(se.reps) || 0) * (Number(se.peso) || 0), 0), 0);

  const pauta = (e) => [
    e.series ? e.series + " × " + (e.reps || "?") : null,
    e.peso ? fmt(e.peso, 1) + " kg" : null,
    e.descanso ? "descanso " + e.descanso + " s" : null,
  ].filter(Boolean).join(" · ");

  /* ================= Rutinas: crear y editar ================= */
  function nuevaRutina(p, onHecho) {
    // Sin la tabla de registros en la base la rutina solo viviría en memoria y el paciente nunca la vería
    if (!NP.store.registrosListos()) {
      toast("⚠️ Antes hay que activar el seguimiento en la base de datos (supabase/esquema.sql)");
      return;
    }
    const fNombre = el("input", { value: "Rutina de " + new Date().toLocaleDateString("es-ES", { month: "long" }) });
    const fDias = el("input", { type: "number", min: 1, max: 7, value: 3 });
    const m = modal({
      title: "🏋️ Nueva rutina",
      body: el("div", {}, [
        el("label", { class: "field" }, [el("span", {}, "Nombre de la rutina"), fNombre]),
        el("label", { class: "field" }, [el("span", {}, "¿Cuántos días de entreno por semana?"), fDias]),
        el("div", { class: "small muted" }, "Después añades los ejercicios de cada día."),
      ]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"),
        el("button", { class: "btn btn-primary", onclick: () => {
          const n = Math.min(7, Math.max(1, Number(fDias.value) || 3));
          const rt = NP.store.saveRegistro({
            tipo: "rutina", pacienteId: p.id, fecha: hoyISO(),
            nombre: fNombre.value.trim() || "Rutina", nota: "", activa: !rutinaActiva(p.id),
            dias: Array.from({ length: n }, (_, i) => ({ id: NP.util.uid(), nombre: "Día " + (i + 1), ejercicios: [] })),
          });
          m.close();
          onHecho ? onHecho(rt) : NP.app.go("#/rutina/" + rt.id);
        } }, "Crear rutina"),
      ],
    });
  }

  /** Elegir ejercicio del catálogo o escribirlo a mano */
  function elegirEjercicio(onPick) {
    const q = el("input", { type: "search", placeholder: "Buscar ejercicio o escribir uno nuevo...", class: "grow" });
    const lista = el("div", { class: "ej-pick" });
    let grupo = "", material = "";
    /** Fila de chips de filtro; al pulsar uno activo se desmarca */
    function filtros(opciones, get, set) {
      const fila = el("div", { class: "ej-filtros" });
      const pintarFila = () => {
        fila.innerHTML = "";
        [["", "Todos"]].concat(opciones).forEach(([k, l]) => fila.appendChild(el("button", {
          class: "chip-filtro" + (get() === k ? " activo" : ""),
          onclick: () => { set(get() === k ? "" : k); pintarFila(); pintar(); },
        }, l)));
      };
      pintarFila();
      return fila;
    }
    const filaGrupos = filtros(NP.EJERCICIOS.map((g) => [g.grupo, g.ic + " " + g.grupo]), () => grupo, (v) => { grupo = v; });
    const filaMat = filtros(NP.MATERIALES.map((m) => [m.key, m.label]).concat([["corporal", "Peso corporal"]]),
      () => material, (v) => { material = v; });
    function pintar() {
      lista.innerHTML = "";
      const t = sinAcentos(q.value.trim());
      let hay = 0;
      NP.EJERCICIOS.forEach((g) => {
        if (grupo && g.grupo !== grupo) return;
        const res = g.lista.filter((n) => (!t || sinAcentos(n).indexOf(t) >= 0) &&
          (!material || NP.materialesDe(n, g.grupo).indexOf(material) >= 0));
        if (!res.length) return;
        hay += res.length;
        lista.appendChild(el("div", { class: "doc-sec", style: "margin:14px 0 6px" }, [
          el("span", { class: "doc-sec-ic" }, g.ic), el("span", {}, g.grupo),
        ]));
        lista.appendChild(el("div", { class: "ej-chips" }, res.map((n) =>
          el("button", { class: "btn btn-sm", onclick: () => { m.close(); onPick({ nombre: n, grupo: g.grupo }); } }, n))));
      });
      if (q.value.trim()) {
        lista.appendChild(el("div", { style: "margin-top:16px" }, [
          el("button", { class: "btn btn-primary", onclick: () => { m.close(); onPick({ nombre: q.value.trim(), grupo: "Otros" }); } },
            "＋ Añadir «" + q.value.trim() + "»"),
        ]));
      } else if (!hay) lista.appendChild(el("div", { class: "empty" }, "Sin resultados."));
    }
    q.addEventListener("input", NP.util.debounce(pintar, 120));
    const total = NP.EJERCICIOS.reduce((s, g) => s + g.lista.length, 0);
    const m = modal({ title: "Añadir ejercicio · " + total + " en el catálogo", wide: true, body: el("div", {}, [
      el("div", { class: "toolbar" }, [q]),
      el("div", { class: "small muted", style: "margin:2px 0 4px" }, "Grupo muscular"), filaGrupos,
      el("div", { class: "small muted", style: "margin:8px 0 4px" }, "Material disponible en su gimnasio"), filaMat,
      lista,
    ]) });
    pintar();
  }

  /* ================= Editor de la rutina (nutricionista) ================= */
  function editor(view, rutinaId) {
    const rt = NP.store.getRegistro(rutinaId);
    if (!rt || rt.tipo !== "rutina") { NP.app.go("#/pacientes"); return; }
    const p = NP.store.getPaciente(rt.pacienteId);
    if (!p) { NP.app.go("#/pacientes"); return; }
    NP.app.setTitle("Rutina · " + p.nombre);
    const guardar = () => NP.store.saveRegistro(rt);
    const recargar = () => NP.app.route();

    const fNombre = el("input", { value: rt.nombre, style: "font-weight:650" });
    fNombre.addEventListener("change", () => { rt.nombre = fNombre.value.trim() || "Rutina"; guardar(); });
    const fNota = el("textarea", { rows: 2, placeholder: "Indicaciones generales: calentamiento, cadencia, progresión semanal..." }, [rt.nota || ""]);
    fNota.addEventListener("change", () => { rt.nota = fNota.value.trim(); guardar(); });

    view.appendChild(el("div", { class: "plan-head" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/entreno/" + p.id) }, "← Entrenamiento de " + p.nombre.split(" ")[0]),
      el("div", { class: "grow" }),
      rt.activa
        ? el("span", { class: "pill accent" }, "✓ Es la rutina activa")
        : el("button", { class: "btn", onclick: () => { activar(p, rt); recargar(); } }, "Marcar como activa"),
      el("button", { class: "btn btn-primary", onclick: () => { guardar(); toast("Rutina guardada ✓"); } }, "Guardar"),
    ]));

    if (!NP.store.registrosListos()) view.appendChild(NP.views.revisiones.avisoBaseDeDatos());
    view.appendChild(el("div", { class: "panel" }, [
      el("label", { class: "field" }, [el("span", {}, "Nombre de la rutina"), fNombre]),
      el("label", { class: "field", style: "margin-bottom:0" }, [el("span", {}, "Indicaciones para el paciente"), fNota]),
    ]));

    const cont = el("div", {});
    view.appendChild(cont);

    function pintarDias() {
      cont.innerHTML = "";
      (rt.dias || []).forEach((d, iDia) => {
        const fDia = el("input", { value: d.nombre, class: "dia-nombre" });
        fDia.addEventListener("change", () => { d.nombre = fDia.value.trim() || "Día " + (iDia + 1); guardar(); });

        const filas = el("div", { class: "ej-lista" });
        (d.ejercicios || []).forEach((e, i) => filas.appendChild(filaEjercicio(d, e, i)));

        cont.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "row", style: "align-items:center;gap:10px" }, [
            el("div", { class: "avatar", style: "flex:0 0 auto" }, String(iDia + 1)),
            el("div", { class: "grow" }, [fDia]),
            el("span", { class: "small muted", style: "flex:0 0 auto" }, (d.ejercicios || []).length + " ejercicio(s)"),
            el("button", { class: "btn btn-sm btn-danger", style: "flex:0 0 auto", onclick: () => {
              if (!confirm("¿Quitar «" + d.nombre + "» de la rutina?")) return;
              rt.dias.splice(iDia, 1); guardar(); pintarDias();
            } }, "🗑"),
          ]),
          filas,
          el("button", { class: "btn btn-sm", style: "margin-top:10px", onclick: () => elegirEjercicio((ej) => {
            d.ejercicios = d.ejercicios || [];
            d.ejercicios.push({ id: NP.util.uid(), nombre: ej.nombre, grupo: ej.grupo, series: 4, reps: "10", peso: null, descanso: 90, nota: "" });
            guardar(); pintarDias();
          }) }, "＋ Añadir ejercicio"),
        ]));
      });

      cont.appendChild(el("button", { class: "btn", style: "margin-top:14px", onclick: () => {
        rt.dias = rt.dias || [];
        rt.dias.push({ id: NP.util.uid(), nombre: "Día " + (rt.dias.length + 1), ejercicios: [] });
        guardar(); pintarDias();
      } }, "＋ Añadir día"));
    }

    function filaEjercicio(d, e, i) {
      const campo = (attrs, onSet) => {
        const n = el("input", attrs);
        n.addEventListener("change", () => { onSet(n.value); guardar(); });
        return n;
      };
      return el("div", { class: "ej-fila" }, [
        el("div", { class: "ej-nm" }, [
          el("div", { class: "name" }, e.nombre),
          e.grupo ? el("div", { class: "small muted" }, e.grupo) : null,
        ]),
        el("label", { class: "field ej-campo" }, [el("span", {}, "Series"),
          campo({ type: "number", min: 1, max: 12, value: e.series ?? "" }, (v) => { e.series = num(v); })]),
        el("label", { class: "field ej-campo" }, [el("span", {}, "Reps"),
          campo({ value: e.reps ?? "", placeholder: "10 o 8-12" }, (v) => { e.reps = v.trim(); })]),
        el("label", { class: "field ej-campo" }, [el("span", {}, "Peso (kg)"),
          campo({ type: "number", step: 0.5, min: 0, value: e.peso ?? "", placeholder: "—" }, (v) => { e.peso = num(v); })]),
        el("label", { class: "field ej-campo" }, [el("span", {}, "Descanso (s)"),
          campo({ type: "number", min: 0, max: 600, step: 15, value: e.descanso ?? "" }, (v) => { e.descanso = num(v); })]),
        el("label", { class: "field ej-nota" }, [el("span", {}, "Nota"),
          campo({ value: e.nota || "", placeholder: "Técnica, tempo, sustituciones..." }, (v) => { e.nota = v.trim(); })]),
        el("div", { class: "ej-acc" }, [
          el("button", { class: "icon-btn", title: "Subir", onclick: () => {
            if (i === 0) return;
            d.ejercicios.splice(i - 1, 0, d.ejercicios.splice(i, 1)[0]); guardar(); pintarDias();
          } }, "↑"),
          el("button", { class: "icon-btn", title: "Bajar", onclick: () => {
            if (i >= d.ejercicios.length - 1) return;
            d.ejercicios.splice(i + 1, 0, d.ejercicios.splice(i, 1)[0]); guardar(); pintarDias();
          } }, "↓"),
          el("button", { class: "icon-btn", title: "Quitar", onclick: () => {
            d.ejercicios.splice(i, 1); guardar(); pintarDias();
          } }, "🗑"),
        ]),
      ]);
    }

    pintarDias();
  }

  function activar(p, rt) {
    rutinasDe(p.id).forEach((x) => {
      const debe = x.id === rt.id;
      if (!!x.activa !== debe) { x.activa = debe; NP.store.saveRegistro(x); }
    });
    toast("«" + rt.nombre + "» es ahora la rutina activa");
  }

  /* ================= Entrenamiento de un paciente (nutricionista) ================= */
  function nutri(view, pacienteId) {
    const p = NP.store.getPaciente(pacienteId);
    if (!p) { NP.app.go("#/pacientes"); return; }
    const corto = p.nombre.split(" ")[0];
    NP.app.setTitle("Entrenamiento · " + p.nombre);
    const recargar = () => NP.app.route();

    view.appendChild(el("div", { class: "plan-head" }, [
      el("button", { class: "btn btn-ghost", onclick: () => NP.app.go("#/paciente/" + p.id) }, "← Volver a " + corto),
      el("div", { class: "grow" }),
      el("button", { class: "btn btn-primary", onclick: () => nuevaRutina(p) }, "＋ Nueva rutina"),
    ]));
    if (!NP.store.registrosListos()) view.appendChild(NP.views.revisiones.avisoBaseDeDatos());

    let pestana = "rutinas";
    const seg = el("div", { class: "seg" }, [
      el("button", { class: "active", onclick: (e) => setP("rutinas", e.currentTarget) }, "🏋️ Rutinas"),
      el("button", { onclick: (e) => setP("registro", e.currentTarget) }, "📋 Lo que ha entrenado"),
    ]);
    function setP(k, btn) {
      pestana = k;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pintar();
    }
    view.appendChild(el("div", { class: "toolbar" }, [seg]));
    const cuerpo = el("div", {});
    view.appendChild(cuerpo);

    function pintar() {
      cuerpo.innerHTML = "";
      cuerpo.appendChild(pestana === "rutinas" ? panelRutinas() : panelRegistro(p, true, recargar));
    }

    function panelRutinas() {
      const rutinas = rutinasDe(p.id).slice().reverse();
      if (!rutinas.length) {
        return el("div", { class: "empty" }, [
          el("div", { class: "big" }, "🏋️"),
          el("div", {}, corto + " todavía no tiene rutina."),
          el("div", { class: "small muted", style: "margin-top:6px" },
            "Monta los días y los ejercicios: le aparecerán en su apartado «Mi entreno» para seguirlos y apuntar lo que levanta."),
          el("button", { class: "btn", style: "margin-top:16px", onclick: () => nuevaRutina(p) }, "＋ Crear la primera"),
        ]);
      }
      return el("div", { class: "list" }, rutinas.map((rt) => el("div", { class: "list-item" }, [
        el("div", { class: "avatar" }, "🏋️"),
        el("div", { class: "grow", onclick: () => NP.app.go("#/rutina/" + rt.id) }, [
          el("div", { class: "name" }, rt.nombre),
          el("div", { class: "small muted" },
            (rt.dias || []).length + " día(s) · " + nEjercicios(rt) + " ejercicio(s) · creada el " + fechaLarga(rt.fecha)),
        ]),
        rt.activa ? el("span", { class: "pill accent", title: "Es la que ve el paciente" }, "Activa") : null,
        el("button", { class: "btn btn-sm", onclick: () => NP.app.go("#/rutina/" + rt.id) }, "Editar"),
        rt.activa ? null : el("button", { class: "btn btn-sm", onclick: () => { activar(p, rt); recargar(); } }, "Activar"),
        el("button", { class: "btn btn-sm", title: "Copiarla para hacer una versión nueva", onclick: () => {
          const copia = JSON.parse(JSON.stringify(rt));
          delete copia.id; delete copia.creado;
          copia.nombre = rt.nombre + " (copia)"; copia.activa = false; copia.fecha = hoyISO();
          NP.store.saveRegistro(copia); toast("Rutina duplicada"); recargar();
        } }, "Duplicar"),
        el("button", { class: "btn btn-sm btn-danger", onclick: () => {
          if (!confirm("¿Borrar «" + rt.nombre + "»?")) return;
          NP.store.deleteRegistro(rt.id); toast("Rutina borrada"); recargar();
        } }, "🗑"),
      ].filter(Boolean))));
    }

    pintar();
  }

  /* ================= Registro de actividad y progresión ================= */
  function panelRegistro(p, esNutri, recargar) {
    const sesiones = sesionesDe(p.id).slice().reverse();
    const wrap = el("div", {});
    if (!sesiones.length) {
      wrap.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📋"),
        el("div", {}, esNutri ? "Aún no ha apuntado ningún entrenamiento." : "Todavía no has apuntado ningún entrenamiento."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          esNutri ? "Cuando registre una sesión verás aquí los pesos que levanta y su progresión."
            : "Cada vez que entrenes, apunta los pesos: así ves cómo progresas semana a semana."),
      ]));
      return wrap;
    }

    // Progresión de un ejercicio: peso máximo o kg totales por sesión
    const nombres = [...new Set(sesiones.flatMap((s) => (s.ejercicios || []).map((e) => e.nombre)))].sort((a, b) => a.localeCompare(b, "es"));
    const selEj = el("select", {}, nombres.map((n) => el("option", { value: n }, n)));
    const selMedida = el("select", {}, [
      el("option", { value: "peso" }, "Peso máximo levantado"),
      el("option", { value: "volumen" }, "Kg totales (series × reps × peso)"),
    ]);
    const caja = el("div", {});
    function pintarGrafica() {
      caja.innerHTML = "";
      const puntos = [];
      sesiones.slice().reverse().forEach((s) => {
        const ej = (s.ejercicios || []).find((e) => e.nombre === selEj.value);
        if (!ej || !(ej.series || []).length) return;
        const y = selMedida.value === "peso"
          ? Math.max(...ej.series.map((x) => Number(x.peso) || 0))
          : ej.series.reduce((t, x) => t + (Number(x.reps) || 0) * (Number(x.peso) || 0), 0);
        if (y > 0) puntos.push({ x: ms(s.fecha), y });
      });
      if (puntos.length < 2) {
        caja.appendChild(NP.grafica.vacia("Con dos sesiones apuntadas de este ejercicio ya se ve la progresión."));
        return;
      }
      caja.appendChild(NP.grafica.lineas({
        alto: 240,
        series: [{ nombre: selEj.value, unidad: "kg", color: "var(--c-p)", dec: selMedida.value === "peso" ? 1 : 0, puntos }],
      }));
    }
    [selEj, selMedida].forEach((s) => s.addEventListener("change", pintarGrafica));

    wrap.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "side-ttl" }, "📈 Progresión de cargas"),
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Ejercicio"), selEj]),
        el("label", { class: "field" }, [el("span", {}, "Qué mirar"), selMedida]),
      ]),
      caja,
    ]));
    pintarGrafica();

    wrap.appendChild(el("div", { class: "side-ttl", style: "margin:22px 0 10px" }, "Sesiones"));
    sesiones.forEach((s) => {
      const kg = volumen(s);
      wrap.appendChild(el("div", { class: "panel ses-card" }, [
        el("div", { class: "row", style: "align-items:center;gap:10px" }, [
          el("div", { class: "grow" }, [
            el("div", { class: "name" }, fechaLarga(s.fecha) + (s.diaNombre ? " · " + s.diaNombre : "")),
            el("div", { class: "small muted" }, [
              (s.ejercicios || []).length + " ejercicio(s)",
              kg ? fmt(kg) + " kg movidos" : null,
              s.duracion_min ? s.duracion_min + " min" : null,
              s.sensacion ? "esfuerzo " + s.sensacion + "/5" : null,
            ].filter(Boolean).join(" · ")),
          ]),
          !esNutri ? el("button", { class: "btn btn-sm", style: "flex:0 0 auto", onclick: () => {
            const rt = s.rutinaId ? NP.store.getRegistro(s.rutinaId) : null;
            const dia = rt && (rt.dias || []).find((d) => d.id === s.diaId);
            formSesion(p, rt, dia || null, recargar, s);
          } }, "✏️ Editar") : null,
          !esNutri ? el("button", { class: "btn btn-sm btn-danger", style: "flex:0 0 auto", onclick: () => {
            if (!confirm("¿Borrar este entrenamiento?")) return;
            NP.store.deleteRegistro(s.id); toast("Entrenamiento borrado"); recargar();
          } }, "🗑") : null,
        ]),
        el("div", { class: "ses-ejs" }, (s.ejercicios || []).map((e) => el("div", { class: "ses-ej" }, [
          el("span", { class: "ses-nm" }, e.nombre),
          el("span", { class: "small muted" }, (e.series || []).map((x) =>
            (x.reps || "?") + (x.peso ? "×" + fmt(x.peso, 1) + "kg" : "")).join("  ·  ")),
        ]))),
        s.nota ? el("div", { class: "small muted", style: "margin-top:8px;white-space:pre-wrap" }, "📝 " + s.nota) : null,
      ]));
    });
    return wrap;
  }

  /* ================= Registrar una sesión (paciente) ================= */
  /** Anotar un entrenamiento: repeticiones y kg de cada serie.
   *  Con `sesion` se edita una ya guardada; sin ella se parte de los ejercicios del día. */
  function formSesion(p, rt, dia, onHecho, sesion) {
    const s0 = sesion || {};
    const fFecha = el("input", { type: "date", value: s0.fecha || hoyISO(), max: hoyISO() });
    const fDur = el("input", { type: "number", min: 5, max: 300, step: 5, placeholder: "min", value: s0.duracion_min ?? "" });
    const fSens = el("select", {}, [["", "—"], ["1", "1 · muy suave"], ["2", "2 · suave"], ["3", "3 · normal"], ["4", "4 · duro"], ["5", "5 · al límite"]]
      .map(([v, l]) => el("option", { value: v, ...(String(s0.sensacion ?? "") === v ? { selected: true } : {}) }, l)));
    const fNota = el("textarea", { rows: 2, placeholder: "Cómo te has sentido, molestias, cambios..." }, [s0.nota || ""]);

    // De la última vez que hizo este ejercicio se copian los pesos, para no escribirlos otra vez
    const ultimas = {};
    sesionesDe(p.id).forEach((s) => {
      if (sesion && s.id === sesion.id) return;
      (s.ejercicios || []).forEach((e) => { ultimas[e.nombre] = e.series; });
    });
    const pautaDe = (nombre) => ((dia && dia.ejercicios) || []).find((e) => e.nombre === nombre) || {};

    const lista = el("div", {});
    const bloques = [];

    /** Bloque de un ejercicio con sus series (se pueden añadir o quitar) */
    function crearBloque(nombre, seriesIni) {
      const e = pautaDe(nombre);
      const previo = ultimas[nombre] || [];
      const b = { nombre, filas: [] };
      const cajaSeries = el("div", { class: "series", style: "margin-top:10px" });
      const renumerar = () => b.filas.forEach((f, i) => { f.etiqueta.textContent = "Serie " + (i + 1); });
      function nuevaFila(ini) {
        const reps = el("input", { type: "number", min: 0, max: 200, inputmode: "numeric",
          placeholder: e.reps ? "reps (" + e.reps + ")" : "reps", value: ini.reps ?? "" });
        const kg = el("input", { type: "number", min: 0, step: 0.5, inputmode: "decimal", placeholder: "kg", value: ini.peso ?? "" });
        const etiqueta = el("span", { class: "serie-n" }, "");
        const f = { reps, kg, etiqueta };
        f.nodo = el("div", { class: "serie-fila" }, [
          etiqueta, reps, el("span", { class: "serie-x" }, "reps ×"), kg, el("span", { class: "serie-u" }, "kg"),
          el("button", { class: "icon-btn", title: "Quitar esta serie", onclick: () => {
            b.filas.splice(b.filas.indexOf(f), 1); f.nodo.remove(); renumerar(); programar();
          } }, "✕"),
        ]);
        b.filas.push(f); cajaSeries.appendChild(f.nodo); renumerar();
      }
      seriesIni.forEach(nuevaFila);
      b.nodo = el("div", { class: "panel", style: "margin-bottom:12px" }, [
        el("div", { class: "row", style: "align-items:center" }, [
          el("div", { class: "grow" }, [
            el("div", { class: "name" }, nombre),
            el("div", { class: "small muted" }, pauta(e) || "Sin pauta"),
          ]),
          previo.length ? el("span", { class: "pill", style: "flex:0 0 auto", title: "Lo que hiciste la última vez" },
            "última: " + previo.map((x) => (x.reps || "?") + (x.peso ? "×" + x.peso : "")).join(" · ")) : null,
          el("button", { class: "icon-btn", style: "flex:0 0 auto", title: "Quitar este ejercicio", onclick: () => {
            bloques.splice(bloques.indexOf(b), 1); b.nodo.remove(); programar();
          } }, "🗑"),
        ]),
        cajaSeries,
        el("button", { class: "btn btn-sm", style: "margin-top:8px", onclick: () => {
          // La serie nueva copia la anterior: lo normal es repetir peso y reps
          const u = b.filas[b.filas.length - 1];
          nuevaFila(u ? { reps: num(u.reps.value), peso: num(u.kg.value) } : {}); programar();
        } }, "＋ Serie"),
      ]);
      bloques.push(b); lista.appendChild(b.nodo);
    }

    if (sesion) {
      (sesion.ejercicios || []).forEach((e) => crearBloque(e.nombre, (e.series || []).length ? e.series : [{}]));
    } else {
      (dia.ejercicios || []).forEach((e) => {
        const previo = ultimas[e.nombre] || [];
        const n = Math.max(1, Number(e.series) || 3);
        crearBloque(e.nombre, Array.from({ length: n }, (_, i) => {
          const p0 = previo[i] || {};
          return { reps: p0.reps ?? null, peso: p0.peso ?? e.peso ?? null };
        }));
      });
    }

    /* Guardado automático: lo que apunta el paciente se guarda solo mientras escribe
       (medio segundo después de dejar de teclear, para no mandar una escritura por letra)
       y lo pendiente se guarda al instante al cerrar la ventana o la pestaña. */
    const estado = el("span", { class: "small muted grow" }, "Lo que apuntes se guarda solo");
    let pendiente = null, guardada = false;
    function guardar() {
      clearTimeout(pendiente); pendiente = null;
      const ejercicios = bloques.map((b) => ({
        nombre: b.nombre,
        series: b.filas.map((f) => ({ reps: num(f.reps.value), peso: num(f.kg.value) }))
          .filter((s) => s.reps != null || s.peso != null),
      })).filter((e) => e.series.length);
      if (!ejercicios.length) {
        // Si deja vacío un entreno nuevo que ya se había guardado, se quita
        if (!sesion && s0.id) { NP.store.deleteRegistro(s0.id); delete s0.id; delete s0.creado; guardada = false; }
        estado.textContent = "Apunta al menos una serie para guardarlo";
        return;
      }
      // Se modifica el mismo objeto: así la caché de la nube también ve la edición
      NP.store.saveRegistro(Object.assign(s0, {
        tipo: "actividad", pacienteId: p.id, fecha: fFecha.value || hoyISO(),
        rutinaId: s0.rutinaId ?? (rt ? rt.id : null), diaId: s0.diaId ?? (dia ? dia.id : null),
        diaNombre: s0.diaNombre ?? (dia ? dia.nombre : ""), ejercicios,
        duracion_min: num(fDur.value), sensacion: fSens.value ? Number(fSens.value) : null,
        nota: fNota.value.trim(), origen: s0.origen || "paciente",
      }));
      guardada = true;
      estado.textContent = "✓ Guardado";
    }
    function programar() {
      estado.textContent = "Guardando…";
      clearTimeout(pendiente); pendiente = setTimeout(guardar, 600);
    }
    const alCerrarPestana = () => { if (pendiente) guardar(); };
    window.addEventListener("pagehide", alCerrarPestana);

    const titulo = sesion ? "✏️ Editar entrenamiento" : "✏️ Anotar " + dia.nombre;
    const cuerpoForm = el("div", {}, [
      el("div", { class: "row" }, [
        el("label", { class: "field" }, [el("span", {}, "Fecha"), fFecha]),
        el("label", { class: "field" }, [el("span", {}, "Duración (min)"), fDur]),
        el("label", { class: "field" }, [el("span", {}, "Cómo ha ido"), fSens]),
      ]),
      el("div", { class: "small muted", style: "margin:0 0 10px" },
        "Apunta las repeticiones que has hecho y el peso que has levantado en cada serie."),
      lista,
      el("button", { class: "btn btn-sm", style: "margin-bottom:14px", onclick: () => elegirEjercicio((ej) => {
        if (bloques.some((b) => b.nombre === ej.nombre)) { toast("Ese ejercicio ya está en la lista"); return; }
        const previo = ultimas[ej.nombre] || [];
        crearBloque(ej.nombre, previo.length ? previo : [{}, {}, {}]); programar();
      }) }, "＋ Añadir otro ejercicio"),
      el("label", { class: "field" }, [el("span", {}, "Nota"), fNota]),
    ]);
    // Cualquier cosa que escriba o elija en el formulario se guarda sola
    cuerpoForm.addEventListener("input", programar);
    cuerpoForm.addEventListener("change", guardar);

    const m = modal({
      title: titulo, wide: true, body: cuerpoForm,
      footer: [
        estado,
        // «Listo» guarda también lo que venía rellenado de la última vez aunque no lo haya tocado
        el("button", { class: "btn btn-primary", onclick: () => { guardar(); if (guardada) m.close(); } }, "Listo"),
      ],
      onClose: () => {
        window.removeEventListener("pagehide", alCerrarPestana);
        if (pendiente) guardar();
        if (!guardada) return;
        toast(sesion ? "Entrenamiento actualizado ✓" : "¡Entrenamiento apuntado! 💪");
        onHecho && onHecho();
      },
    });
  }

  /* ================= Mi entreno (paciente) ================= */
  function cliente(view) {
    const p = NP.auth.pacienteActual();
    if (!p) return;
    NP.app.setTitle("Mi entreno");
    const recargar = () => NP.app.route();
    const rutinas = rutinasDe(p.id);

    if (!rutinas.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "🏋️"),
        el("div", {}, "Todavía no tienes rutina."),
        el("div", { class: "small muted", style: "margin-top:6px" },
          "Cuando tu nutricionista prepare tu entrenamiento, aparecerá aquí con los ejercicios de cada día."),
        el("button", { class: "btn", style: "margin-top:16px", onclick: () => NP.app.go("#/mi-chat") }, "💬 Escribir a mi nutricionista"),
      ]));
      return;
    }

    let actual = rutinaActiva(p.id);
    let pestana = "rutina";
    const selRut = el("select", {}, rutinas.slice().reverse().map((rt) =>
      el("option", { value: rt.id, ...(rt.id === actual.id ? { selected: true } : {}) }, rt.nombre + (rt.activa ? " (activa)" : ""))));
    selRut.addEventListener("change", () => { actual = NP.store.getRegistro(selRut.value) || actual; pintar(); });

    const seg = el("div", { class: "seg", style: "flex:0 0 auto" }, [
      el("button", { class: "active", onclick: (e) => setP("rutina", e.currentTarget) }, "Mi rutina"),
      el("button", { onclick: (e) => setP("registro", e.currentTarget) }, "Mi progreso"),
    ]);
    function setP(k, btn) {
      pestana = k;
      Array.from(seg.children).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pintar();
    }

    view.appendChild(el("div", { class: "plan-head" }, [
      rutinas.length > 1
        ? el("label", { class: "field", style: "margin:0;flex:0 0 auto;min-width:220px" }, [el("span", {}, "Rutina"), selRut])
        : el("div", { class: "side-ttl", style: "margin:0" }, actual.nombre),
      el("div", { class: "grow" }),
      seg,
    ]));
    const cuerpo = el("div", {});
    view.appendChild(cuerpo);

    function pintar() {
      cuerpo.innerHTML = "";
      if (pestana === "registro") { cuerpo.appendChild(panelRegistro(p, false, recargar)); return; }
      if (actual.nota) cuerpo.appendChild(el("div", { class: "nota-pdf" }, [el("b", {}, "📝 "), actual.nota]));
      cuerpo.appendChild(el("div", { class: "small muted", style: "margin-top:10px" },
        "Cuando entrenes, pulsa «✏️ Anotar entreno» en el día que toque y apunta las repeticiones y los kg de cada serie. " +
        "Lo verás en «Mi progreso»."));
      const hechas = sesionesDe(p.id);
      (actual.dias || []).forEach((d) => {
        const ultima = hechas.filter((s) => s.diaId === d.id).slice(-1)[0];
        cuerpo.appendChild(el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "row", style: "align-items:center;gap:10px" }, [
            el("div", { class: "grow" }, [
              el("div", { class: "side-ttl", style: "margin:0" }, d.nombre),
              el("div", { class: "small muted" }, (d.ejercicios || []).length + " ejercicio(s)" +
                (ultima ? " · última vez el " + fechaLarga(ultima.fecha) : "")),
            ]),
            (d.ejercicios || []).length
              ? el("button", { class: "btn btn-primary", style: "flex:0 0 auto", title: "Apunta las repeticiones y los kg de cada serie",
                  onclick: () => formSesion(p, actual, d, recargar) }, "✏️ Anotar entreno")
              : null,
          ]),
          el("div", { class: "ej-cards" }, (d.ejercicios || []).map((e) => el("div", { class: "ej-card" }, [
            el("div", { class: "grow" }, [
              el("div", { class: "name" }, e.nombre),
              el("div", { class: "small muted" }, pauta(e) || "Sin pauta"),
              e.nota ? el("div", { class: "small muted", style: "margin-top:4px" }, "📝 " + e.nota) : null,
            ]),
          ]))),
        ]));
      });
    }
    pintar();
  }

  return { nutri, cliente, editor, nuevaRutina, rutinaActiva };
})();
