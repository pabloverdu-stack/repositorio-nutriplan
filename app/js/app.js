/* app.js — router hash + arranque + control de acceso (nutricionista / paciente) */
NP.app = (function () {
  const { el } = NP.util;
  const view = () => document.getElementById("view");
  const titleEl = () => document.getElementById("page-title");
  const appEl = () => document.getElementById("app");
  const authRoot = () => document.getElementById("auth-root");

  const TITULOS = {
    pacientes: "Pacientes", recetas: "Recetas", constructor: "Constructor por ingredientes",
    "mi-plan": "Mi menú", "mi-chat": "Mi nutricionista", "mi-docs": "Mis documentos", "mi-perfil": "Mi perfil",
  };

  // Menú lateral según quién ha entrado
  const NAV = {
    nutri: [
      { key: "pacientes", ic: "👥", tx: "Pacientes", hash: "#/pacientes", badge: () => NP.store.noLeidosNutri() },
      { key: "recetas", ic: "🍽️", tx: "Recetas", hash: "#/recetas" },
      { key: "constructor", ic: "🧩", tx: "Constructor", hash: "#/constructor" },
    ],
    cliente: [
      { key: "mi-plan", ic: "🗓️", tx: "Mi menú", hash: "#/mi-plan" },
      { key: "mi-chat", ic: "💬", tx: "Mi nutricionista", hash: "#/mi-chat",
        badge: () => { const p = NP.auth.pacienteActual(); return p ? NP.store.noLeidos(p.id, "paciente") : 0; } },
      { key: "mi-docs", ic: "📁", tx: "Mis documentos", hash: "#/mi-docs" },
      { key: "mi-perfil", ic: "🙋", tx: "Mi perfil", hash: "#/mi-perfil" },
    ],
  };
  // Ruta base -> apartado del menú que queda marcado
  const SECCION = {
    pacientes: "pacientes", paciente: "pacientes", plan: "pacientes", mensajes: "pacientes",
    recetas: "recetas", constructor: "constructor",
    "mi-plan": "mi-plan", "mi-chat": "mi-chat", "mi-docs": "mi-docs", "mi-perfil": "mi-perfil",
  };
  const INICIO = { nutri: "#/pacientes", cliente: "#/mi-plan" };

  function setTitle(t) { titleEl().textContent = t; }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  function setActiveNav(base) {
    const sec = SECCION[base] || base;
    document.querySelectorAll(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.nav === sec));
  }

  /* ---------- Menú lateral y ficha de la sesión ---------- */
  function refrescarNav() {
    const u = NP.auth.actual();
    if (!u) return;
    const nav = document.querySelector(".nav");
    nav.innerHTML = "";
    (NAV[u.rol] || []).forEach((it) => {
      const n = it.badge ? it.badge() : 0;
      nav.appendChild(el("a", { href: it.hash, class: "nav-item", "data-nav": it.key }, [
        el("span", { class: "nav-ic" }, it.ic),
        el("span", { class: "nav-tx" }, it.tx),
        n ? el("span", { class: "nav-badge" }, String(n)) : null,
      ]));
    });
    const foot = document.querySelector(".sidebar-foot");
    foot.innerHTML = "";
    foot.appendChild(el("div", { class: "user-chip" }, [
      el("div", { class: "avatar chico" }, NP.util.iniciales(u.nombre)),
      el("div", { class: "grow" }, [
        el("div", { class: "u-nm" }, u.nombre),
        el("div", { class: "u-rl" }, u.rol === "nutri" ? "Nutricionista" : "Paciente"),
      ]),
      el("button", { class: "icon-btn", title: "Cerrar sesión", onclick: cerrarSesion }, "⎋"),
    ]));
    const base = location.hash.replace(/^#\/?/, "").split("/")[0];
    setActiveNav(base);
  }

  function cerrarSesion() {
    if (!confirm("¿Cerrar sesión?")) return;
    NP.auth.salir();
    location.hash = "";
    mostrarAcceso();
  }

  /* ---------- Router ---------- */
  function route() {
    const u = NP.auth.actual();
    if (!u) { mostrarAcceso(); return; }

    const parts = location.hash.replace(/^#\/?/, "").split("/"); // ['pacientes'] o ['plan','id']
    let base = parts[0] || "";
    // Cada rol solo puede entrar en sus propias rutas
    const permitidas = u.rol === "nutri"
      ? ["pacientes", "paciente", "plan", "mensajes", "recetas", "constructor"]
      : ["mi-plan", "mi-chat", "mi-docs", "mi-perfil"];
    if (permitidas.indexOf(base) < 0) { go(INICIO[u.rol]); return; }

    const v = view();
    v.innerHTML = "";
    // el plan semanal necesita todo el ancho de la pantalla; el resto de vistas se limitan
    v.classList.toggle("full", base === "plan" || base === "mi-plan");
    document.querySelector(".sidebar").classList.remove("open");
    setActiveNav(base);
    if (TITULOS[base]) setTitle(TITULOS[base]);

    switch (base) {
      // --- Nutricionista ---
      case "pacientes": NP.views.pacientes.lista(v); break;
      case "paciente": NP.views.pacientes.detalle(v, parts[1]); break;
      case "plan": NP.views.plan(v, parts[1]); break;
      case "mensajes": NP.views.mensajes(v, parts[1]); break;
      case "recetas": NP.views.recetas(v); break;
      case "constructor": NP.views.constructor(v); break;
      // --- Paciente ---
      case "mi-plan": NP.views.cliente.plan(v); break;
      case "mi-chat": NP.views.cliente.chat(v); break;
      case "mi-docs": NP.views.cliente.documentos(v); break;
      case "mi-perfil": NP.views.cliente.perfil(v); break;
    }
    refrescarNav();
  }

  /* ---------- Acceso ---------- */
  function mostrarAcceso() {
    appEl().hidden = true;
    authRoot().hidden = false;
    NP.views.acceso(authRoot());
  }
  /** Llamado desde la pantalla de acceso cuando alguien entra correctamente */
  function entrarEnLaApp() {
    const u = NP.auth.actual();
    if (!u) { mostrarAcceso(); return; }
    authRoot().hidden = true;
    authRoot().innerHTML = "";
    appEl().hidden = false;
    refrescarNav();
    // Sin hash se pone el de inicio (eso ya dispara el router); con hash se enruta al vuelo,
    // y si es de otro rol el propio router redirige.
    if (!location.hash || location.hash === "#") location.hash = INICIO[u.rol];
    else route();
    if (NP.nube && NP.nube.hayDatosLocales()) ofrecerSubida();
  }

  /* Primera entrada en la nube con pacientes guardados de antes en este
     navegador: se ofrece subirlos para no empezar de cero. */
  function ofrecerSubida() {
    const n = (JSON.parse(localStorage.getItem("np_pacientes") || "[]") || []).length;
    const m = NP.util.modal({
      title: "Subir tus datos a la nube",
      body: el("div", {}, [
        el("div", {}, `Tienes ${n} paciente(s) guardados en este navegador de antes de usar la nube.`),
        el("div", { class: "small muted", style: "margin-top:10px" },
          "Si los subes, pasaran a tu cuenta y los veras desde cualquier dispositivo, " +
          "con sus planes, mensajes y recetas propias. Los de este navegador no se borran."),
      ]),
      footer: [
        el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Ahora no"),
        el("button", { class: "btn btn-primary", onclick: async (ev) => {
          ev.target.disabled = true; ev.target.textContent = "Subiendo...";
          try {
            const r = await NP.nube.migrar();
            m.close();
            NP.util.toast(`Subidos ${r.pacientes} paciente(s) y ${r.planes} plan(es)`);
            route();
          } catch (err) {
            ev.target.disabled = false; ev.target.textContent = "Subir mis datos";
            NP.util.toast("No se pudo subir: " + err.message);
          }
        } }, "Subir mis datos"),
      ],
    });
  }

  async function init() {
    // marca
    document.querySelectorAll("[data-app-name]").forEach((n) => (n.textContent = NP.APP_NAME));
    document.title = NP.APP_NAME;
    // menú móvil
    document.getElementById("btn-menu").addEventListener("click", () =>
      document.querySelector(".sidebar").classList.toggle("open"));

    // pantalla de carga (dentro de la app; la de acceso se muestra al terminar)
    appEl().hidden = false;
    authRoot().hidden = true;
    view().innerHTML = "";
    view().appendChild(el("div", { class: "loading" }, [
      el("div", { class: "spinner" }),
      el("div", { class: "muted" }, "Cargando recetario y base de alimentos..."),
    ]));

    try {
      const info = await NP.data.cargar();
      console.log("Datos cargados:", info);
    } catch (e) {
      view().innerHTML = "";
      view().appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "⚠️"),
        el("div", {}, "No se pudieron cargar los datos."),
        el("div", { class: "small muted", style: "margin-top:6px" }, "Sirve la carpeta con un servidor (no abras el index.html directamente)."),
      ]));
      console.error(e); return;
    }

    // Modo nube: si js/config.js tiene las claves, NP.auth y NP.store pasan a
    // hablar con Supabase. Si no, todo sigue guardandose en este navegador.
    try {
      if (NP.nube && NP.nube.configurado) await NP.nube.iniciar();
    } catch (e) {
      console.error("[nube] arranque", e);
      NP.util.toast("No se ha podido conectar con la nube; se trabajara en local.");
    }

    window.addEventListener("hashchange", route);
    if (NP.auth.actual()) entrarEnLaApp(); else mostrarAcceso();
  }

  return { go, route, setTitle, init, refrescarNav, cerrarSesion, entrarEnLaApp };
})();

document.addEventListener("DOMContentLoaded", NP.app.init);
