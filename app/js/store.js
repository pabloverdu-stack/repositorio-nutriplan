/* store.js — persistencia local (localStorage) */
NP.store = (function () {
  const K = { pac: "np_pacientes", plan: "np_planes", prop: "np_propias", msg: "np_mensajes", fav: "np_favoritas" };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---- Pacientes ----
  const getPacientes = () => read(K.pac, []);
  const getPaciente = (id) => getPacientes().find((p) => p.id === id) || null;
  function savePaciente(p) {
    const list = getPacientes();
    if (!p.id) { p.id = NP.util.uid(); list.push(p); }
    else { const i = list.findIndex((x) => x.id === p.id); i >= 0 ? (list[i] = p) : list.push(p); }
    write(K.pac, list); return p;
  }
  function deletePaciente(id) {
    write(K.pac, getPacientes().filter((p) => p.id !== id));
    write(K.plan, getPlanes().filter((pl) => pl.pacienteId !== id));
    write(K.msg, read(K.msg, []).filter((m) => m.pacienteId !== id));
  }

  // ---- Planes ----
  const getPlanes = () => read(K.plan, []);
  const getPlan = (id) => getPlanes().find((p) => p.id === id) || null;
  const planesDe = (pacienteId) => getPlanes().filter((p) => p.pacienteId === pacienteId);
  function savePlan(pl) {
    const list = getPlanes();
    if (!pl.id) { pl.id = NP.util.uid(); list.push(pl); }
    else { const i = list.findIndex((x) => x.id === pl.id); i >= 0 ? (list[i] = pl) : list.push(pl); }
    write(K.plan, list); return pl;
  }
  const deletePlan = (id) => write(K.plan, getPlanes().filter((p) => p.id !== id));

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

  // ---- Mensajes (canal de comunicación con el paciente) ----
  const getMensajes = () => read(K.msg, []);
  const mensajesDe = (pacienteId) =>
    getMensajes().filter((m) => m.pacienteId === pacienteId).sort((a, b) => a.fecha - b.fecha);
  function saveMensaje(msg) {
    const list = getMensajes();
    if (!msg.id) { msg.id = NP.util.uid(); msg.fecha = msg.fecha || Date.now(); list.push(msg); }
    else { const i = list.findIndex((x) => x.id === msg.id); i >= 0 ? (list[i] = msg) : list.push(msg); }
    write(K.msg, list); return msg;
  }
  const deleteMensaje = (id) => write(K.msg, getMensajes().filter((m) => m.id !== id));
  const ultimoMensaje = (pacienteId) => { const l = mensajesDe(pacienteId); return l.length ? l[l.length - 1] : null; };

  return {
    getPacientes, getPaciente, savePaciente, deletePaciente,
    getPlanes, getPlan, planesDe, savePlan, deletePlan,
    getPropias, savePropia, deletePropia,
    getFavoritas, esFavorita, toggleFavorita,
    getMensajes, mensajesDe, saveMensaje, deleteMensaje, ultimoMensaje,
  };
})();
