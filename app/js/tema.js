/* tema.js — selector de combinación de colores (arriba a la derecha).
   El tema se guarda en este navegador; las variables de cada tema están en styles.css. */
NP.tema = (function () {
  const { el } = NP.util;
  const KEY = "np_tema";
  // muestra = [fondo, superficie, acento] para pintar la pastilla del menú
  const TEMAS = [
    { id: "", nombre: "Estándar (oscuro)", muestra: ["#0d0f14", "#1e2430", "#5fd0a6"] },
    { id: "rosa", nombre: "Rosa", muestra: ["#fdf3f6", "#fbe7ee", "#d6457f"] },
    { id: "blanco", nombre: "Blanco neutro", muestra: ["#f5f6f8", "#ffffff", "#2f8f6f"] },
    { id: "lavanda", nombre: "Lavanda", muestra: ["#f6f3fc", "#eee8fa", "#8a5cd6"] },
    { id: "melocoton", nombre: "Melocotón", muestra: ["#fff6f0", "#fdeadf", "#e0714f"] },
    { id: "oceano", nombre: "Océano (oscuro)", muestra: ["#0b1220", "#19253b", "#4fb3ff"] },
  ];

  function actual() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }
  function aplicar(id) {
    if (id) document.documentElement.setAttribute("data-theme", id);
    else document.documentElement.removeAttribute("data-theme");
  }
  function elegir(id) {
    try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento: solo esta sesión */ }
    aplicar(id);
  }

  function montar() {
    const sitio = document.querySelector(".topbar-right");
    if (!sitio || sitio.querySelector(".tema-wrap")) return;
    const menu = el("div", { class: "tema-menu", hidden: true });
    const btn = el("button", { class: "icon-btn", title: "Cambiar colores", "aria-haspopup": "true" }, "🎨");

    function pintar() {
      const cur = actual();
      menu.innerHTML = "";
      menu.appendChild(el("div", { class: "tema-tit" }, "Tema de colores"));
      TEMAS.forEach((t) => menu.appendChild(el("button", {
        class: "tema-op" + (t.id === cur ? " on" : ""),
        onclick: () => { elegir(t.id); pintar(); },
      }, [
        el("span", { class: "tema-mu" }, t.muestra.map((c) => el("i", { style: "background:" + c }))),
        el("span", {}, t.nombre),
        t.id === cur ? el("span", { class: "chk" }, "✓") : null,
      ])));
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.hidden) pintar();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu.hidden = true; });
    sitio.appendChild(el("div", { class: "tema-wrap" }, [btn, menu]));
  }

  aplicar(actual());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  return { TEMAS, actual, elegir };
})();
