/* util.js — namespace global y helpers de UI */
window.NP = window.NP || {};
NP.APP_NAME = "NutriPlan"; // <- cambia aquí el nombre de la marca

NP.util = (function () {
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, "");
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  };

  const sinAcentos = (s) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2));

  const fmt = (v, d = 0) => {
    if (v == null || isNaN(v)) return "0";
    return Number(v).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const iniciales = (nombre) =>
    (nombre || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // Modal genérico. opts: {title, body(HTMLElement), footer(HTMLElement), wide}
  function modal(opts) {
    const root = document.getElementById("modal-root");
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const box = el("div", { class: "modal" + (opts.wide ? " wide" : "") }, [
      el("div", { class: "modal-head" }, [
        el("h3", { text: opts.title || "" }),
        el("button", { class: "icon-btn", text: "✕", onclick: close }),
      ]),
      el("div", { class: "modal-body" }, [opts.body]),
      opts.footer ? el("div", { class: "modal-foot" }, opts.footer) : null,
    ]);
    const overlay = el("div", { class: "modal-overlay", onclick: (e) => { if (e.target === overlay) close(); } }, [box]);
    root.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    return { close, box };
  }

  function toast(msg) {
    const root = document.getElementById("toast-root");
    const t = el("div", { class: "toast", text: msg });
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".3s"; setTimeout(() => t.remove(), 300); }, 2200);
  }

  // debounce
  const debounce = (fn, ms = 180) => {
    let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
  };

  return { el, sinAcentos, uid, fmt, iniciales, modal, toast, debounce };
})();
