/* auth.js — cuentas de nutricionista y de paciente (cliente)
   IMPORTANTE: todo se guarda en el navegador (localStorage). No es un sistema de
   seguridad real: sirve para separar lo que ve cada persona en este ordenador.
   Las contraseñas se guardan como hash con sal, nunca en claro. */
NP.auth = (function () {
  const K = { users: "np_usuarios", sesion: "np_sesion" };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const norm = (s) => (s || "").trim().toLowerCase();

  // ---- Hash de contraseña ----
  // Con servidor local (http://localhost) el navegador ofrece crypto.subtle -> SHA-256.
  // Si la app se abriera de otra forma sin ese API, se usa un hash simple de reserva.
  function hashSimple(txt) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < txt.length; i++) {
      const c = txt.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }
  async function hashPass(pass, salt) {
    const txt = salt + "::" + pass;
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
        return { algo: "sha256", valor: [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("") };
      } catch { /* sigue con el de reserva */ }
    }
    return { algo: "simple", valor: hashSimple(txt) };
  }
  async function comprobar(user, pass) {
    if (!user) return false;
    if (user.algo === "sha256" && !(window.crypto && crypto.subtle)) return false;
    const h = await hashPass(pass, user.salt);
    return h.algo === user.algo && h.valor === user.hash;
  }
  const nuevaSal = () => NP.util.uid().replace(/-/g, "").slice(0, 16);

  // ---- Usuarios ----
  const getUsuarios = () => read(K.users, []);
  const porEmail = (email) => getUsuarios().find((u) => u.email === norm(email)) || null;
  const getUsuario = (id) => getUsuarios().find((u) => u.id === id) || null;
  const hayNutricionistas = () => getUsuarios().some((u) => u.rol === "nutri");
  function guardarUsuario(u) {
    const l = getUsuarios();
    const i = l.findIndex((x) => x.id === u.id);
    i >= 0 ? (l[i] = u) : l.push(u);
    write(K.users, l);
    return u;
  }

  // ---- Sesión ----
  const sesion = () => read(K.sesion, null);
  function actual() {
    const s = sesion();
    return s ? getUsuario(s.userId) : null;
  }
  const esNutri = () => { const u = actual(); return !!u && u.rol === "nutri"; };
  const esCliente = () => { const u = actual(); return !!u && u.rol === "cliente"; };
  /** Id del nutricionista dueño de los datos que se están viendo (nutri propio o el del cliente) */
  function nutriId() {
    const u = actual();
    if (!u) return null;
    return u.rol === "nutri" ? u.id : u.nutriId || null;
  }
  /** Ficha del paciente asociado a la sesión de cliente */
  function pacienteActual() {
    const u = actual();
    return u && u.rol === "cliente" ? NP.store.getPacienteGlobal(u.pacienteId) : null;
  }
  const entrar = (u) => write(K.sesion, { userId: u.id, desde: Date.now() });
  const salir = () => localStorage.removeItem(K.sesion);

  // ---- Alta de nutricionista ----
  async function registrarNutri({ nombre, email, pass }) {
    nombre = (nombre || "").trim();
    if (!nombre) throw new Error("Escribe tu nombre.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm(email))) throw new Error("El email no parece válido.");
    if ((pass || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    if (porEmail(email)) throw new Error("Ya existe una cuenta con ese email.");
    const primero = !hayNutricionistas();
    const salt = nuevaSal();
    const h = await hashPass(pass, salt);
    const u = { id: NP.util.uid(), rol: "nutri", nombre, email: norm(email), salt, algo: h.algo, hash: h.valor, creado: Date.now() };
    guardarUsuario(u);
    // Los pacientes que ya existían en este navegador (antes de haber cuentas) pasan
    // a ser del primer nutricionista que se registra, para no perder el trabajo hecho.
    if (primero) NP.store.adoptarHuerfanos(u.id);
    return u;
  }

  // ---- Alta de cliente (paciente) con el código que le da su nutricionista ----
  async function registrarCliente({ codigo, email, pass }) {
    const pac = NP.store.pacientePorCodigo(codigo);
    if (!pac) throw new Error("Ese código de acceso no existe. Pídeselo a tu nutricionista.");
    if (getUsuarios().some((u) => u.rol === "cliente" && u.pacienteId === pac.id))
      throw new Error("Este paciente ya tiene una cuenta creada. Entra con su email y contraseña.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm(email))) throw new Error("El email no parece válido.");
    if ((pass || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    if (porEmail(email)) throw new Error("Ya existe una cuenta con ese email.");
    const salt = nuevaSal();
    const h = await hashPass(pass, salt);
    const u = {
      id: NP.util.uid(), rol: "cliente", nombre: pac.nombre, email: norm(email),
      salt, algo: h.algo, hash: h.valor, pacienteId: pac.id, nutriId: pac.nutriId || null, creado: Date.now(),
    };
    guardarUsuario(u);
    // Si el paciente no tenía email guardado, se aprovecha el de su cuenta
    if (!pac.email) { pac.email = u.email; NP.store.savePacienteGlobal(pac); }
    return u;
  }

  // ---- Entrar ----
  async function login({ email, pass, rol }) {
    const u = porEmail(email);
    if (!u) throw new Error("No hay ninguna cuenta con ese email.");
    if (rol && u.rol !== rol)
      throw new Error(u.rol === "nutri"
        ? "Esa cuenta es de nutricionista. Usa el acceso de nutricionista."
        : "Esa cuenta es de paciente. Usa el acceso de paciente.");
    if (!(await comprobar(u, pass))) throw new Error("Contraseña incorrecta.");
    if (u.rol === "cliente" && !NP.store.getPacienteGlobal(u.pacienteId))
      throw new Error("Tu ficha ya no existe. Habla con tu nutricionista.");
    entrar(u);
    return u;
  }

  async function cambiarPass(userId, actualPass, nueva) {
    const u = getUsuario(userId);
    if (!u) throw new Error("Cuenta no encontrada.");
    if (!(await comprobar(u, actualPass))) throw new Error("La contraseña actual no es correcta.");
    if ((nueva || "").length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
    const salt = nuevaSal();
    const h = await hashPass(nueva, salt);
    u.salt = salt; u.algo = h.algo; u.hash = h.valor;
    guardarUsuario(u);
    return u;
  }

  /** Cuenta de cliente asociada a un paciente (para que el nutri vea si ya la ha creado) */
  const cuentaDePaciente = (pacienteId) =>
    getUsuarios().find((u) => u.rol === "cliente" && u.pacienteId === pacienteId) || null;
  /** Borra la cuenta de cliente de un paciente (al borrar el paciente o al reiniciar su acceso) */
  function borrarCuentaDePaciente(pacienteId) {
    const l = getUsuarios().filter((u) => !(u.rol === "cliente" && u.pacienteId === pacienteId));
    write(K.users, l);
    const s = sesion();
    if (s && !getUsuario(s.userId)) salir();
  }

  return {
    registrarNutri, registrarCliente, login, salir, actual, esNutri, esCliente,
    nutriId, pacienteActual, hayNutricionistas, cambiarPass,
    cuentaDePaciente, borrarCuentaDePaciente, getUsuario,
  };
})();
