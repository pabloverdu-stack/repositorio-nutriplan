/* store.js — persistencia local (localStorage)
   Cada paciente pertenece a un nutricionista (nutriId): un nutricionista solo ve
   los suyos, y un paciente que entra como cliente solo ve su propia ficha. */
NP.store = (function () {
  const K = { pac: "np_pacientes", plan: "np_planes", prop: "np_propias", msg: "np_mensajes", fav: "np_favoritas" };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---- Ámbito según quién ha entrado ----
  // nutri -> sus pacientes; cliente -> solo su ficha; sin sesión -> nada.
  function ambito() {
    if (!NP.auth) return { tipo: "todo" };
    const u = NP.auth.actual();
    if (!u) return { tipo: "nadie" };
    return u.rol === "nutri" ? { tipo: "nutri", id: u.id } : { tipo: "cliente", pacienteId: u.pacienteId };
  }
  function visible(p) {
    const a = ambito();
    if (a.tipo === "todo") return true;
    if (a.tipo === "nadie") return false;
    if (a.tipo === "cliente") return p.id === a.pacienteId;
    return p.nutriId === a.id;
  }

  // ---- Pacientes ----
  const allPacientes = () => read(K.pac, []);
  const getPacientes = () => allPacientes().filter(visible);
  /** Ficha por id respetando el ámbito (null si no es tuya) */
  const getPaciente = (id) => getPacientes().find((p) => p.id === id) || null;
  /** Ficha por id sin filtrar: solo para el login del cliente y el canje de códigos */
  const getPacienteGlobal = (id) => allPacientes().find((p) => p.id === id) || null;

  function escribirPaciente(p) {
    const list = allPacientes();
    if (!p.id) { p.id = NP.util.uid(); list.push(p); }
    else { const i = list.findIndex((x) => x.id === p.id); i >= 0 ? (list[i] = p) : list.push(p); }
    write(K.pac, list); return p;
  }
  function savePaciente(p) {
    // Un paciente nuevo se cuelga del nutricionista que lo crea
    if (!p.nutriId) { const a = ambito(); if (a.tipo === "nutri") p.nutriId = a.id; }
    return escribirPaciente(p);
  }
  /** Guardado sin tocar el dueño (login del cliente, canje de código) */
  const savePacienteGlobal = (p) => escribirPaciente(p);

  function deletePaciente(id) {
    write(K.pac, allPacientes().filter((p) => p.id !== id));
    write(K.plan, allPlanes().filter((pl) => pl.pacienteId !== id));
    write(K.msg, getMensajes().filter((m) => m.pacienteId !== id));
    if (NP.auth) NP.auth.borrarCuentaDePaciente(id);
  }

  /** Al registrarse el primer nutricionista adopta los pacientes que ya hubiera
      en este navegador de antes de existir las cuentas. */
  function adoptarHuerfanos(nutriId) {
    const list = allPacientes();
    let n = 0;
    list.forEach((p) => { if (!p.nutriId) { p.nutriId = nutriId; n++; } });
    if (n) write(K.pac, list);
    return n;
  }

  // ---- Código de acceso del paciente ----
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1 (se confunden al dictarlos)
  function nuevoCodigo() {
    let c;
    do {
      c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    } while (allPacientes().some((p) => p.codigo_acceso === c));
    return c;
  }
  /** Devuelve (creándolo si hace falta) el código con el que el paciente crea su cuenta */
  function codigoAcceso(pacienteId) {
    const p = getPacienteGlobal(pacienteId);
    if (!p) return null;
    if (!p.codigo_acceso) { p.codigo_acceso = nuevoCodigo(); escribirPaciente(p); }
    return p.codigo_acceso;
  }
  function regenerarCodigo(pacienteId) {
    const p = getPacienteGlobal(pacienteId);
    if (!p) return null;
    p.codigo_acceso = nuevoCodigo(); escribirPaciente(p);
    return p.codigo_acceso;
  }
  const pacientePorCodigo = (codigo) => {
    const c = (codigo || "").trim().toUpperCase().replace(/\s+/g, "");
    return c ? allPacientes().find((p) => p.codigo_acceso === c) || null : null;
  };

  // ---- Planes ----
  const allPlanes = () => read(K.plan, []);
  const getPlanes = () => {
    const ids = new Set(getPacientes().map((p) => p.id));
    return allPlanes().filter((pl) => ids.has(pl.pacienteId));
  };
  const getPlan = (id) => getPlanes().find((p) => p.id === id) || null;
  const planesDe = (pacienteId) => getPlanes().filter((p) => p.pacienteId === pacienteId);
  function savePlan(pl) {
    const list = allPlanes();
    if (!pl.id) { pl.id = NP.util.uid(); list.push(pl); }
    else { const i = list.findIndex((x) => x.id === pl.id); i >= 0 ? (list[i] = pl) : list.push(pl); }
    write(K.plan, list); return pl;
  }
  const deletePlan = (id) => write(K.plan, allPlanes().filter((p) => p.id !== id));

  // ---- Recetas propias ----
  const getPropias = () => read(K.prop, []);
  function savePropia(r) {
    const list = getPropias();
    if (!r.id) { r.id = "P" + NP.util.uid().slice(0, 8); r.propia = true; list.push(r); }
    else { const i = list.findIndex((x) => x.id === r.id); i >= 0 ? (list[i] = r) : list.push(r); }
    write(K.prop, list); return r;
  }
  const deletePropia = (id) => write(K.prop, getPropias().filter((r) => r.id !== id));

  // ---- Recetas favoritas (ids) ----
  const getFavoritas = () => read(K.fav, []);
  const esFavorita = (id) => getFavoritas().indexOf(id) >= 0;
  function toggleFavorita(id) {
    const l = getFavoritas();
    const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1); else l.push(id);
    write(K.fav, l);
    return i < 0; // true si ha quedado marcada como favorita
  }

  // ---- Mensajes (chat entre nutricionista y paciente) ----
  const getMensajes = () => read(K.msg, []);
  const mensajesDe = (pacienteId) =>
    getMensajes().filter((m) => m.pacienteId === pacienteId).sort((a, b) => a.fecha - b.fecha);
  function saveMensaje(msg) {
    const list = getMensajes();
    if (!msg.id) {
      msg.id = NP.util.uid();
      msg.fecha = msg.fecha || Date.now();
      if (msg.leido === undefined) msg.leido = false;
      list.push(msg);
    } else { const i = list.findIndex((x) => x.id === msg.id); i >= 0 ? (list[i] = msg) : list.push(msg); }
    write(K.msg, list); return msg;
  }
  const deleteMensaje = (id) => write(K.msg, getMensajes().filter((m) => m.id !== id));
  const ultimoMensaje = (pacienteId) => { const l = mensajesDe(pacienteId); return l.length ? l[l.length - 1] : null; };

  /** Mensajes sin leer que ha recibido "quien" ("nutri" o "paciente") en ese hilo */
  function noLeidos(pacienteId, quien) {
    const otro = quien === "nutri" ? "paciente" : "nutri";
    return getMensajes().filter((m) => m.pacienteId === pacienteId && m.autor === otro && !m.leido).length;
  }
  /** Marca como leídos los mensajes que "quien" acaba de ver al abrir el hilo */
  function marcarLeidos(pacienteId, quien) {
    const otro = quien === "nutri" ? "paciente" : "nutri";
    const list = getMensajes();
    let n = 0;
    list.forEach((m) => { if (m.pacienteId === pacienteId && m.autor === otro && !m.leido) { m.leido = true; n++; } });
    if (n) write(K.msg, list);
    return n;
  }
  /** Total sin leer del nutricionista, sumando todos sus pacientes (aviso del menú) */
  const noLeidosNutri = () => getPacientes().reduce((s, p) => s + noLeidos(p.id, "nutri"), 0);

  return {
    getPacientes, getPaciente, getPacienteGlobal, savePaciente, savePacienteGlobal, deletePaciente,
    adoptarHuerfanos, codigoAcceso, regenerarCodigo, pacientePorCodigo,
    getPlanes, getPlan, planesDe, savePlan, deletePlan,
    getPropias, savePropia, deletePropia,
    getFavoritas, esFavorita, toggleFavorita,
    getMensajes, mensajesDe, saveMensaje, deleteMensaje, ultimoMensaje,
    noLeidos, marcarLeidos, noLeidosNutri,
  };
})();
