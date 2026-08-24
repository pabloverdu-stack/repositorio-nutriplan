/* app.js — router hash + arranque */
NP.app = (function () {
  const view = () => document.getElementById("view");
  const titleEl = () => document.getElementById("page-title");

  const TITULOS = { pacientes: "Pacientes", recetas: "Recetas", constructor: "Constructor por ingredientes" };

  function setTitle(t) { titleEl().textContent = t; }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  function setActiveNav(base) {
    document.querySelectorAll(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.nav === base));
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/"); // ['pacientes'] o ['plan','id']
    const base = parts[0] || "pacientes";
    const v = view();
    v.innerHTML = "";
    // el plan semanal necesita todo el ancho de la pantalla; el resto de vistas se limitan para que se lean bien
    v.classList.toggle("full", base === "plan");
    // cerrar sidebar en móvil
    document.querySelector(".sidebar").classList.remove("open");

    switch (base) {
      case "pacientes":
        setActiveNav("pacientes"); setTitle(TITULOS.pacientes); NP.views.pacientes.lista(v); break;
      case "paciente":
        setActiveNav("pacientes"); NP.views.pacientes.detalle(v, parts[1]); break;
      case "plan":
        setActiveNav("pacientes"); NP.views.plan(v, parts[1]); break;
      case "mensajes":
        setActiveNav("pacientes"); NP.views.mensajes(v, parts[1]); break;
      case "recetas":
        setActiveNav("recetas"); setTitle(TITULOS.recetas); NP.views.recetas(v); break;
      case "constructor":
        setActiveNav("constructor"); setTitle(TITULOS.constructor); NP.views.constructor(v); break;
      default:
        go("#/pacientes");
    }
  }

  async function init() {
    // marca
    document.querySelectorAll("[data-app-name]").forEach((n) => (n.textContent = NP.APP_NAME));
    document.title = NP.APP_NAME;
    // menú móvil
    document.getElementById("btn-menu").addEventListener("click", () =>
      document.querySelector(".sidebar").classList.toggle("open"));

    // pantalla de carga
    view().innerHTML = "";
    view().appendChild(NP.util.el("div", { class: "loading" }, [
      NP.util.el("div", { class: "spinner" }),
      NP.util.el("div", { class: "muted" }, "Cargando recetario y base de alimentos..."),
    ]));

    try {
      const info = await NP.data.cargar();
      console.log("Datos cargados:", info);
    } catch (e) {
      view().innerHTML = "";
      view().appendChild(NP.util.el("div", { class: "empty" }, [
        NP.util.el("div", { class: "big" }, "⚠️"),
        NP.util.el("div", {}, "No se pudieron cargar los datos."),
        NP.util.el("div", { class: "small muted", style: "margin-top:6px" }, "Sirve la carpeta con un servidor (no abras el index.html directamente)."),
      ]));
      console.error(e); return;
    }

    window.addEventListener("hashchange", route);
    if (!location.hash) location.hash = "#/pacientes"; else route();
  }

  return { go, route, setTitle, init };
})();

document.addEventListener("DOMContentLoaded", NP.app.init);
