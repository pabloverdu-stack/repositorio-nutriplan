/* nube.js — modo nube: cuentas y datos en Supabase en vez de en el navegador.
   ---------------------------------------------------------------------------
   Si js/config.js tiene la URL y la clave, este archivo SUSTITUYE a NP.auth y
   a NP.store por versiones que hablan con la base de datos. Si no, no hace
   nada y la app sigue funcionando en local exactamente igual que antes.

   Cómo funciona por dentro: al entrar se descarga de una vez todo lo que ese
   usuario puede ver (sus pacientes, planes y mensajes; son pocos datos) y se
   guarda en memoria. Las consultas leen de ahí, así que siguen siendo
   instantáneas y las vistas no han tenido que cambiar. Cada vez que se guarda
   algo se actualiza la memoria y se manda el cambio a la nube en segundo
   plano; si ese envío falla, se avisa con un aviso emergente. */
NP.nube = (function () {
  const cfg = NP.config || {};
  const configurado = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  let sb = null;
  let activo = false;
  let usuario = null;      // { id, rol, nombre, email, pacienteId, nutriId }
  let nutriNombre = "";    // nombre del nutricionista (lo necesita el paciente)

  // Copia en memoria de lo que este usuario puede ver
  const C = { pacientes: [], planes: [], mensajes: [], propias: [], favoritas: [] };

  /* ---------- Utilidades ---------- */
  const uid = () => NP.util.uid();
  function fallo(e, que) {
    console.error("[nube] " + que, e);
    NP.util.toast("⚠️ No se pudo guardar " + que + " en la nube");
  }
  // Envío en segundo plano: la app no espera, pero si falla se avisa
  function enviar(promesa, que) {
    Promise.resolve(promesa)
      .then((r) => { if (r && r.error) fallo(r.error, que); })
      .catch((e) => fallo(e, que));
  }
  const limpio = (s) => (s || "").trim().toLowerCase();
  const esEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio(s));

  // Mensajes de Supabase traducidos a algo que entienda una persona
  function traducir(e) {
    const m = (e && e.message) || String(e);
    if (/already registered|already been registered/i.test(m)) return "Ya existe una cuenta con ese email.";
    if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
    if (/Email not confirmed/i.test(m)) return "Tienes que confirmar tu email antes de entrar. Mira tu correo.";
    if (/Password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/CODIGO_INVALIDO/.test(m)) return "Ese código de acceso no existe. Pídeselo a tu nutricionista.";
    if (/YA_TIENE_CUENTA/.test(m)) return "Este paciente ya tiene una cuenta. Entra con su email y contraseña.";
    if (/NO_AUTORIZADO/.test(m)) return "Ese paciente no es tuyo.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión con la base de datos. Revisa tu internet.";
    return m;
  }

  /* ---------- Conversión entre las filas de la base y los objetos de la app ---------- */
  const pacienteApp = (f) => Object.assign({}, f.datos, {
    id: f.id, nutriId: f.nutri_id, codigo_acceso: f.codigo_acceso,
    cuenta_creada: f.cuenta_creada, cuenta_email: f.cuenta_email,
  });
  function pacienteFila(p) {
    const datos = Object.assign({}, p);
    ["id", "nutriId", "codigo_acceso", "cuenta_creada", "cuenta_email"].forEach((k) => delete datos[k]);
    return { id: p.id, nutri_id: p.nutriId, codigo_acceso: p.codigo_acceso || null, datos };
  }

  const planApp = (f) => ({
    id: f.id, pacienteId: f.paciente_id, nombre: f.nombre,
    comidas: (f.datos && f.datos.comidas) || null, dias: (f.datos && f.datos.dias) || {},
  });
  const planFila = (pl) => ({
    id: pl.id, paciente_id: pl.pacienteId, nombre: pl.nombre || "Plan",
    datos: { comidas: pl.comidas || null, dias: pl.dias || {} },
  });

  const msgApp = (f) => ({
    id: f.id, pacienteId: f.paciente_id, autor: f.autor, texto: f.texto,
    canal: f.canal, leido: !!f.leido, fecha: new Date(f.fecha).getTime(),
  });
  const msgFila = (m) => ({
    id: m.id, paciente_id: m.pacienteId, autor: m.autor, texto: m.texto,
    canal: m.canal || "app", leido: !!m.leido, fecha: new Date(m.fecha).toISOString(),
  });

  const propiaApp = (f) => Object.assign({}, f.datos, { id: f.id, propia: true });
  function propiaFila(r) {
    const datos = Object.assign({}, r);
    delete datos.id;
    return { id: r.id, nutri_id: usuario.id, datos };
  }

  /* ---------- Arranque ---------- */
  async function iniciar() {
    if (!configurado) return false;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn("[nube] No se ha podido cargar la librería de Supabase; se sigue en modo local.");
      return false;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    activo = true;
    instalar();
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) await cargarSesion();
    } catch (e) {
      console.error("[nube] sesión", e);
    }
    return true;
  }

  /** Lee el perfil del usuario que ha entrado y se descarga sus datos */
  async function cargarSesion() {
    const { data: { user } = {} } = await sb.auth.getUser();
    if (!user) { usuario = null; return; }

    const { data: perfil, error } = await sb
      .from("perfiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!perfil) {
      // Cuenta a medio crear (se registró pero no llegó a guardarse el perfil)
      await sb.auth.signOut();
      usuario = null;
      throw new Error("Tu cuenta quedó a medias. Vuelve a registrarte.");
    }

    usuario = {
      id: user.id, email: user.email, rol: perfil.rol,
      nombre: perfil.nombre || user.email, pacienteId: perfil.paciente_id || null, nutriId: null,
    };
    await cargarDatos();

    if (usuario.rol === "cliente") {
      const ficha = C.pacientes[0];
      usuario.nutriId = ficha ? ficha.nutriId : null;
      nutriNombre = "tu nutricionista";
      if (usuario.nutriId) {
        const { data: pn } = await sb.from("perfiles").select("nombre").eq("id", usuario.nutriId).maybeSingle();
        if (pn && pn.nombre) nutriNombre = pn.nombre;
      }
    } else {
      usuario.nutriId = usuario.id;
    }
  }

  /** Descarga de una vez todo lo que este usuario puede ver */
  async function cargarDatos() {
    const [pac, pla, msg, pro, fav] = await Promise.all([
      sb.from("pacientes").select("*"),
      sb.from("planes").select("*"),
      sb.from("mensajes").select("*").order("fecha", { ascending: true }),
      sb.from("recetas_propias").select("*"),
      sb.from("favoritas").select("receta_id"),
    ]);
    [pac, pla, msg, pro, fav].forEach((r) => { if (r.error) throw r.error; });
    C.pacientes = (pac.data || []).map(pacienteApp);
    C.planes = (pla.data || []).map(planApp);
    C.mensajes = (msg.data || []).map(msgApp);
    C.propias = (pro.data || []).map(propiaApp);
    C.favoritas = (fav.data || []).map((f) => f.receta_id);
  }

  function limpiarMemoria() {
    usuario = null; nutriNombre = "";
    C.pacientes = []; C.planes = []; C.mensajes = []; C.propias = []; C.favoritas = [];
  }

  /* ================= NP.auth en modo nube ================= */
  const authNube = {
    async registrarNutri({ nombre, email, pass }) {
      nombre = (nombre || "").trim();
      if (!nombre) throw new Error("Escribe tu nombre.");
      if (!esEmail(email)) throw new Error("El email no parece válido.");
      if ((pass || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

      const { data, error } = await sb.auth.signUp({ email: limpio(email), password: pass });
      if (error) throw new Error(traducir(error));
      if (!data.session) throw new Error("Cuenta creada. Confirma el email desde tu correo y luego entra.");

      const { error: e2 } = await sb.from("perfiles")
        .insert({ id: data.user.id, rol: "nutri", nombre });
      if (e2) throw new Error("La cuenta se creó pero falló el perfil: " + traducir(e2));

      await cargarSesion();
      return usuario;
    },

    async registrarCliente({ codigo, email, pass }) {
      const cod = (codigo || "").trim().toUpperCase();
      if (!cod) throw new Error("Escribe tu código de acceso.");
      if (!esEmail(email)) throw new Error("El email no parece válido.");
      if ((pass || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

      // Se comprueba el código ANTES de crear la cuenta, para no dejar
      // cuentas huérfanas si el código estaba mal escrito.
      const { data: ok, error: e0 } = await sb.rpc("codigo_disponible", { codigo: cod });
      if (e0) throw new Error(traducir(e0));
      if (ok === "NO_EXISTE") throw new Error("Ese código de acceso no existe. Pídeselo a tu nutricionista.");
      if (ok === "OCUPADO") throw new Error("Este paciente ya tiene una cuenta. Entra con su email y contraseña.");

      const { data, error } = await sb.auth.signUp({ email: limpio(email), password: pass });
      if (error) throw new Error(traducir(error));
      if (!data.session) throw new Error("Cuenta creada. Confirma el email desde tu correo y luego entra.");

      const { error: e2 } = await sb.rpc("canjear_codigo", { codigo: cod });
      if (e2) throw new Error(traducir(e2));

      await cargarSesion();
      return usuario;
    },

    async login({ email, pass, rol }) {
      const { error } = await sb.auth.signInWithPassword({ email: limpio(email), password: pass });
      if (error) throw new Error(traducir(error));
      await cargarSesion();
      if (!usuario) throw new Error("No se ha podido cargar tu cuenta.");
      if (rol && usuario.rol !== rol) {
        const esNutriCuenta = usuario.rol === "nutri";
        authNube.salir();
        throw new Error(esNutriCuenta
          ? "Esa cuenta es de nutricionista. Usa el acceso de nutricionista."
          : "Esa cuenta es de paciente. Usa el acceso de paciente.");
      }
      return usuario;
    },

    salir() { enviar(sb.auth.signOut(), "el cierre de sesión"); limpiarMemoria(); },

    actual: () => usuario,
    esNutri: () => !!usuario && usuario.rol === "nutri",
    esCliente: () => !!usuario && usuario.rol === "cliente",
    nutriId: () => (usuario ? usuario.nutriId : null),
    pacienteActual: () => (usuario && usuario.rol === "cliente"
      ? C.pacientes.find((p) => p.id === usuario.pacienteId) || null : null),
    hayNutricionistas: () => true, // en la nube no se puede (ni debe) consultar

    async cambiarPass(_userId, actualPass, nueva) {
      if ((nueva || "").length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
      // Supabase no comprueba la contraseña anterior: se verifica entrando otra vez
      const { error: e1 } = await sb.auth.signInWithPassword({ email: usuario.email, password: actualPass });
      if (e1) throw new Error("La contraseña actual no es correcta.");
      const { error: e2 } = await sb.auth.updateUser({ password: nueva });
      if (e2) throw new Error(traducir(e2));
      return usuario;
    },

    cuentaDePaciente(pacienteId) {
      const p = C.pacientes.find((x) => x.id === pacienteId);
      return p && p.cuenta_creada ? { email: p.cuenta_email || "(su email)", rol: "cliente", pacienteId } : null;
    },

    borrarCuentaDePaciente(pacienteId) {
      const p = C.pacientes.find((x) => x.id === pacienteId);
      if (p) { p.cuenta_creada = false; p.cuenta_email = null; }
      enviar(sb.rpc("revocar_acceso", { p_paciente_id: pacienteId }), "la retirada de acceso");
    },

    // Solo se usa para mostrar el nombre del nutricionista en la vista del paciente
    getUsuario(id) {
      if (!id) return null;
      if (usuario && id === usuario.id) return usuario;
      if (usuario && id === usuario.nutriId) return { id, nombre: nutriNombre, rol: "nutri" };
      return null;
    },
  };

  /* ================= NP.store en modo nube ================= */
  const storeNube = {
    // ---- Pacientes ----
    getPacientes: () => C.pacientes.slice(),
    getPaciente: (id) => C.pacientes.find((p) => p.id === id) || null,
    getPacienteGlobal: (id) => C.pacientes.find((p) => p.id === id) || null,

    savePaciente(p) {
      if (!p.id) { p.id = uid(); C.pacientes.push(p); }
      else if (!C.pacientes.some((x) => x.id === p.id)) C.pacientes.push(p);
      if (!p.nutriId && usuario && usuario.rol === "nutri") p.nutriId = usuario.id;
      enviar(sb.from("pacientes").upsert(pacienteFila(p)), "la ficha del paciente");
      return p;
    },
    savePacienteGlobal(p) { return storeNube.savePaciente(p); },

    deletePaciente(id) {
      C.pacientes = C.pacientes.filter((p) => p.id !== id);
      C.planes = C.planes.filter((pl) => pl.pacienteId !== id);
      C.mensajes = C.mensajes.filter((m) => m.pacienteId !== id);
      // La base borra en cascada los planes y mensajes de ese paciente
      enviar(sb.from("pacientes").delete().eq("id", id), "el borrado del paciente");
    },

    adoptarHuerfanos: () => 0, // no aplica en la nube

    codigoAcceso(pacienteId) {
      const p = C.pacientes.find((x) => x.id === pacienteId);
      if (!p) return null;
      if (!p.codigo_acceso) {
        p.codigo_acceso = nuevoCodigo();
        enviar(sb.from("pacientes").update({ codigo_acceso: p.codigo_acceso }).eq("id", p.id), "el código de acceso");
      }
      return p.codigo_acceso;
    },
    regenerarCodigo(pacienteId) {
      const p = C.pacientes.find((x) => x.id === pacienteId);
      if (!p) return null;
      p.codigo_acceso = nuevoCodigo();
      enviar(sb.from("pacientes").update({ codigo_acceso: p.codigo_acceso }).eq("id", p.id), "el código de acceso");
      return p.codigo_acceso;
    },
    // En la nube el canje lo hace la propia base de datos (canjear_codigo)
    pacientePorCodigo: () => null,

    // ---- Planes ----
    getPlanes: () => C.planes.slice(),
    getPlan: (id) => C.planes.find((p) => p.id === id) || null,
    planesDe: (pacienteId) => C.planes.filter((p) => p.pacienteId === pacienteId),
    savePlan(pl) {
      if (!pl.id) { pl.id = uid(); C.planes.push(pl); }
      else if (!C.planes.some((x) => x.id === pl.id)) C.planes.push(pl);
      enviar(sb.from("planes").upsert(planFila(pl)), "el plan");
      return pl;
    },
    deletePlan(id) {
      C.planes = C.planes.filter((p) => p.id !== id);
      enviar(sb.from("planes").delete().eq("id", id), "el borrado del plan");
    },

    // ---- Recetas propias ----
    getPropias: () => C.propias.slice(),
    savePropia(r) {
      if (!r.id) { r.id = "P" + uid().slice(0, 8); r.propia = true; C.propias.push(r); }
      else if (!C.propias.some((x) => x.id === r.id)) C.propias.push(r);
      enviar(sb.from("recetas_propias").upsert(propiaFila(r)), "la receta");
      return r;
    },
    deletePropia(id) {
      C.propias = C.propias.filter((r) => r.id !== id);
      enviar(sb.from("recetas_propias").delete().eq("id", id), "el borrado de la receta");
    },

    // ---- Favoritas ----
    getFavoritas: () => C.favoritas.slice(),
    esFavorita: (id) => C.favoritas.indexOf(id) >= 0,
    toggleFavorita(id) {
      const i = C.favoritas.indexOf(id);
      if (i >= 0) {
        C.favoritas.splice(i, 1);
        enviar(sb.from("favoritas").delete().eq("nutri_id", usuario.id).eq("receta_id", id), "la favorita");
        return false;
      }
      C.favoritas.push(id);
      enviar(sb.from("favoritas").upsert({ nutri_id: usuario.id, receta_id: id }), "la favorita");
      return true;
    },

    // ---- Mensajes ----
    getMensajes: () => C.mensajes.slice(),
    mensajesDe: (pacienteId) => C.mensajes
      .filter((m) => m.pacienteId === pacienteId).sort((a, b) => a.fecha - b.fecha),
    saveMensaje(msg) {
      if (!msg.id) {
        msg.id = uid();
        msg.fecha = msg.fecha || Date.now();
        if (msg.leido === undefined) msg.leido = false;
        C.mensajes.push(msg);
      } else if (!C.mensajes.some((m) => m.id === msg.id)) C.mensajes.push(msg);
      enviar(sb.from("mensajes").upsert(msgFila(msg)), "el mensaje");
      return msg;
    },
    deleteMensaje(id) {
      C.mensajes = C.mensajes.filter((m) => m.id !== id);
      enviar(sb.from("mensajes").delete().eq("id", id), "el borrado del mensaje");
    },
    ultimoMensaje(pacienteId) {
      const l = storeNube.mensajesDe(pacienteId);
      return l.length ? l[l.length - 1] : null;
    },
    noLeidos(pacienteId, quien) {
      const otro = quien === "nutri" ? "paciente" : "nutri";
      return C.mensajes.filter((m) => m.pacienteId === pacienteId && m.autor === otro && !m.leido).length;
    },
    marcarLeidos(pacienteId, quien) {
      const otro = quien === "nutri" ? "paciente" : "nutri";
      const ids = [];
      C.mensajes.forEach((m) => {
        if (m.pacienteId === pacienteId && m.autor === otro && !m.leido) { m.leido = true; ids.push(m.id); }
      });
      if (ids.length) enviar(sb.from("mensajes").update({ leido: true }).in("id", ids), "los mensajes leídos");
      return ids.length;
    },
    noLeidosNutri: () => C.pacientes.reduce((s, p) => s + storeNube.noLeidos(p.id, "nutri"), 0),
  };

  // Código de acceso: sin I, O, 0 ni 1, que se confunden al dictarlos
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function nuevoCodigo() {
    let c;
    do {
      c = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
    } while (C.pacientes.some((p) => p.codigo_acceso === c));
    return c;
  }

  function instalar() { NP.auth = authNube; NP.store = storeNube; }

  /* ---------- Subida de los datos que ya tenías en este navegador ---------- */
  const leerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };

  /** ¿Hay pacientes guardados en este navegador que aún no estén en la nube? */
  function hayDatosLocales() {
    if (!activo || !usuario || usuario.rol !== "nutri") return false;
    if (localStorage.getItem("np_migrado")) return false;
    return leerLocal("np_pacientes").length > 0;
  }

  /** Sube a la nube los pacientes, planes, mensajes y recetas de este navegador */
  async function migrar() {
    const pacientes = leerLocal("np_pacientes");
    const planes = leerLocal("np_planes");
    const mensajes = leerLocal("np_mensajes");
    const propias = leerLocal("np_propias");
    const favoritas = leerLocal("np_favoritas");
    const idsPac = new Set(pacientes.map((p) => p.id));

    const filasPac = pacientes.map((p) => pacienteFila(Object.assign({}, p, { nutriId: usuario.id })));
    if (filasPac.length) {
      const { error } = await sb.from("pacientes").upsert(filasPac);
      if (error) throw new Error(traducir(error));
    }
    const filasPlan = planes.filter((pl) => idsPac.has(pl.pacienteId)).map(planFila);
    if (filasPlan.length) {
      const { error } = await sb.from("planes").upsert(filasPlan);
      if (error) throw new Error(traducir(error));
    }
    const filasMsg = mensajes.filter((m) => idsPac.has(m.pacienteId))
      .map((m) => msgFila(Object.assign({ canal: "nota", leido: true, fecha: Date.now() }, m)));
    if (filasMsg.length) {
      const { error } = await sb.from("mensajes").upsert(filasMsg);
      if (error) throw new Error(traducir(error));
    }
    if (propias.length) {
      const { error } = await sb.from("recetas_propias").upsert(propias.map(propiaFila));
      if (error) throw new Error(traducir(error));
    }
    if (favoritas.length) {
      const { error } = await sb.from("favoritas")
        .upsert(favoritas.map((rid) => ({ nutri_id: usuario.id, receta_id: rid })));
      if (error) throw new Error(traducir(error));
    }

    localStorage.setItem("np_migrado", new Date().toISOString());
    await cargarDatos();
    return { pacientes: pacientes.length, planes: filasPlan.length, mensajes: filasMsg.length };
  }

  return {
    iniciar, migrar, hayDatosLocales,
    get activo() { return activo; },
    get configurado() { return configurado; },
  };
})();
