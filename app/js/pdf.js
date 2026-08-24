/* pdf.js — genera el PDF del plan semanal con la plantilla de marca.
   Usa la impresión nativa del navegador (Guardar como PDF): sin librerías ni dependencias.
   Plantilla espejo de pdf_plan/generar_pdf.py (esta es la que usa la app). */
NP.pdf = (function () {
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const k = (v) => Math.round(v || 0).toLocaleString("es-ES");

  // Datos del profesional (editables desde Ajustes en el futuro)
  const NUTRI = { nombre: "", titulo: "Dietista-Nutricionista", contacto: "" };

  // Un hueco puede llevar varios platos (p. ej. arroz con pollo + ensalada): devuelve todos.
  function comidasDe(slot) {
    return NP.slot.lista(slot).map((item) => {
      if (item.kind === "alimentos") {
        return { nombre: item.nombre || "Alimentos", nutricion: item.nutricion,
                 ingredientes: item.ingredientes, elaboracion: ["Pesa cada alimento y combínalos."] };
      }
      const r = NP.data.getReceta(item.refId);
      if (!r) return null;
      if (item.custom) {
        return { nombre: r.nombre, nutricion: item.custom.nutricion,
                 ingredientes: item.custom.ingredientes, elaboracion: r.elaboracion };
      }
      return { nombre: r.nombre, nutricion: r.nutricion, ingredientes: r.ingredientes, elaboracion: r.elaboracion };
    }).filter(Boolean);
  }
  // Primer plato del hueco (se mantiene por compatibilidad con llamadas externas)
  const comidaDe = (slot) => comidasDe(slot)[0] || null;
  const slotDe = (plan, d, c) => (plan.dias[d.key] && plan.dias[d.key][c.key]) || null;

  function macroPct(n) {
    const h = (n.hidratos_g || 0) * 4, p = (n.proteinas_g || 0) * 4, g = (n.grasas_g || 0) * 9;
    const t = h + p + g || 1;
    return [h / t * 100, p / t * 100, g / t * 100];
  }

  function construirHTML(plan, pac, opts) {
    opts = opts || {};
    const comidas = Array.isArray(plan.comidas) ? plan.comidas : NP.COMIDAS;
    const nutri = Object.assign({}, NUTRI, opts.nutri || {});

    // totales por día
    const tot = {};
    NP.DIAS.forEach((d) => {
      const s = { energia_kcal: 0, proteinas_g: 0, hidratos_g: 0, grasas_g: 0 };
      comidas.forEach((c) => comidasDe(slotDe(plan, d, c)).forEach((cm) => {
        Object.keys(s).forEach((key) => (s[key] += cm.nutricion[key] || 0));
      }));
      tot[d.key] = s;
    });
    const media = NP.DIAS.reduce((a, d) => a + tot[d.key].energia_kcal, 0) / 7;

    // rejilla semanal
    const DIA_LBL = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
                      viernes: "Viernes", sabado: "Sábado", domingo: "Domingo" };
    let filas = "";
    comidas.forEach((c) => {
      let celdas = "";
      NP.DIAS.forEach((d) => {
        const cms = comidasDe(slotDe(plan, d, c));
        if (!cms.length) { celdas += '<td class="g-vacio">—</td>'; return; }
        const kcal = cms.reduce((a, cm) => a + (cm.nutricion.energia_kcal || 0), 0);
        const noms = cms.map((cm) => `<div class="g-nom">${esc(cm.nombre)}</div>`).join("");
        celdas += `<td>${noms}<div class="g-k">${k(kcal)} kcal</div></td>`;
      });
      filas += `<tr><th class="g-lbl">${esc(c.label)}</th>${celdas}</tr>`;
    });
    let filaTot = "";
    NP.DIAS.forEach((d) => { filaTot += `<td class="g-tot"><b>${k(tot[d.key].energia_kcal)}</b><span>kcal</span></td>`; });
    filas += `<tr class="g-total"><th class="g-lbl">Total día</th>${filaTot}</tr>`;
    const cab = NP.DIAS.map((d) => `<th>${DIA_LBL[d.key] || d.key}</th>`).join("");
    const rejilla = `<table class="grid"><thead><tr><th></th>${cab}</tr></thead><tbody>${filas}</tbody></table>`;

    // páginas por día
    let diasHTML = "";
    NP.DIAS.forEach((d) => {
      const t = tot[d.key];
      const [ph, pp, pg] = macroPct(t);
      let bloques = "";
      comidas.forEach((c) => {
        const cms = comidasDe(slotDe(plan, d, c));
        if (!cms.length) return;
        // La cabecera de la comida lleva el total de todos sus platos
        const n = { energia_kcal: 0, hidratos_g: 0, proteinas_g: 0, grasas_g: 0, fibra_g: 0 };
        cms.forEach((cm) => Object.keys(n).forEach((key) => (n[key] += cm.nutricion[key] || 0)));
        const varios = cms.length > 1;
        // Con varios platos, cada uno lleva su subtítulo con sus propias kcal
        const platos = cms.map((cm) => {
          const ings = (cm.ingredientes || []).map((i) =>
            `<li><span class="i-n">${esc(i.nombre)}${i.casera ? ` <em>· ${esc(i.casera)}</em>` : ""}</span>` +
            `<span class="i-g">${i.gramos} g</span></li>`).join("");
          const pasos = (cm.elaboracion || []).map((p) => `<li>${esc(p)}</li>`).join("");
          const sub = varios
            ? `<div class="dish-sub"><span class="ds-nom">${esc(cm.nombre)}</span>` +
              `<span class="ds-k">${k(cm.nutricion.energia_kcal)} kcal</span></div>`
            : "";
          return sub + `
        <div class="meal-body">
          <div class="col-ing"><h4>Ingredientes</h4><ul class="ings">${ings}</ul></div>
          <div class="col-elab"><h4>Elaboración</h4><ol class="pasos">${pasos}</ol></div>
        </div>`;
        }).join("");
        bloques += `
      <section class="meal">
        <div class="meal-head">
          <span class="meal-tag">${esc(c.label)}</span>
          <h3>${cms.map((cm) => esc(cm.nombre)).join(" <span class=\"h3-mas\">+</span> ")}</h3>
          <span class="meal-kcal">${k(n.energia_kcal)} kcal</span>
        </div>
        <div class="meal-macros">
          <span class="mm"><i class="d-h"></i>Hidratos <b>${Math.round(n.hidratos_g)} g</b></span>
          <span class="mm"><i class="d-p"></i>Proteínas <b>${Math.round(n.proteinas_g)} g</b></span>
          <span class="mm"><i class="d-g"></i>Grasas <b>${Math.round(n.grasas_g)} g</b></span>
          <span class="mm"><i class="d-f"></i>Fibra <b>${Math.round(n.fibra_g)} g</b></span>
        </div>${platos}
      </section>`;
      });
      if (!bloques) return;
      diasHTML += `
  <div class="page day-page">
    <div class="day-head">
      <div class="day-title"><span class="day-dot"></span><h2>${DIA_LBL[d.key] || d.key}</h2></div>
      <div class="day-sum">
        <div class="ds-k"><b>${k(t.energia_kcal)}</b> kcal</div>
        <div class="ds-bar"><i style="width:${ph.toFixed(1)}%" class="b-h"></i><i style="width:${pp.toFixed(1)}%" class="b-p"></i><i style="width:${pg.toFixed(1)}%" class="b-g"></i></div>
        <div class="ds-m">H ${Math.round(t.hidratos_g)} g · P ${Math.round(t.proteinas_g)} g · G ${Math.round(t.grasas_g)} g</div>
      </div>
    </div>${bloques}
  </div>`;
    });

    const pie = (nutri.nombre || nutri.contacto)
      ? `<div class="cover-foot"><div><b>${esc(nutri.nombre)}</b>${nutri.titulo ? " · " + esc(nutri.titulo) : ""}</div><div>${esc(nutri.contacto)}</div></div>`
      : "";

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${esc(plan.nombre)} · ${esc(pac.nombre)}</title><style>${CSS}${CSS_SCREEN}</style></head><body>
  <div class="page cover">
    <div class="cover-band">
      <div class="brand">
        <div class="logo">&#9681;</div>
        <div><div class="brand-name">${esc(NP.APP_NAME)}</div><div class="brand-sub">Plan nutricional personalizado</div></div>
      </div>
      <div class="cover-meta">
        <div class="plan-name">${esc(plan.nombre)}</div>
        <div class="pac">${esc(pac.nombre)}</div>
        <div class="obj">${esc(pac.objetivo || "")}${pac.kcal_objetivo ? " · objetivo " + k(pac.kcal_objetivo) + " kcal/día" : ""}</div>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${k(media)}</b><span>kcal media / día</span></div>
      <div class="kpi"><b>7</b><span>días planificados</span></div>
      <div class="kpi"><b>${comidas.length}</b><span>comidas al día</span></div>
      <div class="kpi"><b>${k(pac.kcal_objetivo || 0)}</b><span>objetivo diario</span></div>
    </div>
    <h2 class="sec-title">Tu semana de un vistazo</h2>
    ${rejilla}
    <div class="nota"><b>Cómo usar tu plan:</b> esta semana se repite durante el mes. En las páginas
      siguientes tienes cada día con las cantidades exactas, los ingredientes y la elaboración de cada
      comida. Si un día no te apetece una comida, consúltame y te paso una alternativa equivalente.</div>
    ${pie}
  </div>${diasHTML}
</body></html>`;
  }

  const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { background: #0b0d12; }
body { margin:0; font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
  color:#f0f4f9; font-size:10.5pt; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
h1,h2,h3,h4 { margin:0; font-weight:700; letter-spacing:-.01em; }
.page { width:210mm; padding:13mm 12mm 12mm; background:#0b0d12; position:relative; }
.page.cover { min-height:297mm; page-break-after:always; }
.day-page { padding-top:6mm; }
.cover-band { background:linear-gradient(135deg,#16202b 0%,#14312a 60%,#14453a 100%);
  border:1px solid #2f3a48; border-radius:16px; padding:24px 26px; margin-bottom:20px;
  display:flex; justify-content:space-between; align-items:flex-start; }
.brand { display:flex; align-items:center; gap:12px; }
.logo { width:42px; height:42px; border-radius:12px; background:#5fd0a6; color:#04231a;
  display:flex; align-items:center; justify-content:center; font-size:23px; font-weight:800; }
.brand-name { font-size:17pt; font-weight:800; letter-spacing:-.02em; color:#fff; }
.brand-sub { font-size:8.5pt; color:#9fd9c4; margin-top:2px; }
.cover-meta { text-align:right; }
.cover-meta .plan-name { font-size:14pt; font-weight:800; color:#5fd0a6; }
.cover-meta .pac { font-size:11.5pt; margin-top:3px; color:#fff; font-weight:600; }
.cover-meta .obj { font-size:9pt; color:#b9c4d2; margin-top:4px; }
.kpis { display:flex; gap:11px; margin-bottom:20px; }
.kpi { flex:1; border:1px solid #2a3341; border-radius:12px; padding:12px 14px; background:#161c26; }
.kpi b { display:block; font-size:17pt; color:#5fd0a6; line-height:1.1; }
.kpi span { font-size:7.8pt; color:#9aa7b8; text-transform:uppercase; letter-spacing:.07em; }
.sec-title { font-size:12pt; margin:0 0 11px; display:flex; align-items:center; gap:9px; color:#fff; }
.sec-title::before { content:""; width:4px; height:16px; background:#5fd0a6; border-radius:3px; }
.grid { width:100%; border-collapse:separate; border-spacing:0; font-size:8.2pt; table-layout:fixed; }
.grid th,.grid td { border:1px solid #2a3341; padding:7px; vertical-align:top; background:#12171f; }
.grid thead th { background:#5fd0a6; color:#04231a; font-size:9pt; font-weight:800; text-align:center;
  padding:8px 4px; border-color:#5fd0a6; }
.grid thead th:first-child { background:transparent; border-color:transparent; width:66px; }
.grid th.g-lbl { background:#232d3b; font-size:8.2pt; color:#fff; font-weight:700; text-align:left; width:66px; }
.g-nom { font-weight:600; color:#f0f4f9; line-height:1.3; display:-webkit-box; -webkit-line-clamp:3;
  -webkit-box-orient:vertical; overflow:hidden; }
/* Varios platos en la misma comida: se separan con una línea fina */
.g-nom + .g-nom { -webkit-line-clamp:2; margin-top:4px; padding-top:4px; border-top:1px dashed #2f3a48; }
.g-k { color:#5fd0a6; font-weight:800; margin-top:3px; font-size:7.8pt; }
.g-vacio { color:#4a5566; text-align:center; }
.g-total td { background:#1c2430; text-align:center; }
.g-total b { color:#5fd0a6; font-size:10.5pt; }
.g-total span { color:#9aa7b8; font-size:7pt; display:block; }
.cover-foot { margin-top:18px; border-top:1px solid #2a3341; padding-top:12px; display:flex;
  justify-content:space-between; font-size:8.5pt; color:#9aa7b8; }
.cover-foot b { color:#f0f4f9; }
.nota { margin-top:16px; background:#122b25; border:1px solid #2f5f4f; border-left:4px solid #5fd0a6;
  border-radius:10px; padding:12px 14px; font-size:8.8pt; color:#cfe9df; }
.nota b { color:#7ee0bb; }
.day-head { display:flex; justify-content:space-between; align-items:center;
  background:linear-gradient(135deg,#16202b,#14352c); border:1px solid #2f3a48; border-radius:13px;
  padding:13px 18px; margin-bottom:15px; page-break-inside:avoid; page-break-after:avoid; }
.day-title { display:flex; align-items:center; gap:10px; }
.day-dot { width:10px; height:10px; border-radius:50%; background:#5fd0a6; display:inline-block; }
.day-head h2 { font-size:15pt; color:#fff; }
.day-sum { text-align:right; min-width:175px; }
.ds-k { font-size:10.5pt; color:#b9c4d2; } .ds-k b { color:#5fd0a6; font-size:14pt; }
.ds-bar { height:6px; border-radius:3px; overflow:hidden; background:#2a3341; display:flex; margin:5px 0 4px; }
.ds-bar i { display:block; height:100%; }
.ds-m { font-size:8pt; color:#b9c4d2; }
.b-h,.d-h { background:#f0c274; } .b-p,.d-p { background:#7bb8ff; }
.b-g,.d-g { background:#f28db2; } .d-f { background:#a8d08d; }
.meal { border:1px solid #2a3341; border-radius:13px; margin-bottom:12px; page-break-inside:avoid;
  overflow:hidden; background:#12171f; }
.meal-head { display:flex; align-items:center; gap:11px; padding:11px 15px; background:#1c2430;
  border-bottom:1px solid #2a3341; }
.meal-tag { background:#5fd0a6; color:#04231a; font-size:7.5pt; font-weight:800; padding:4px 10px;
  border-radius:20px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
.meal-head h3 { font-size:11.5pt; flex:1; color:#fff; }
.h3-mas { color:#5fd0a6; font-weight:800; margin:0 2px; }
.meal-kcal { color:#5fd0a6; font-weight:800; font-size:11pt; white-space:nowrap; }
/* Subtítulo de cada plato cuando la comida lleva más de uno */
.dish-sub { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:7px 15px; background:#151b24; border-top:1px solid #222a36; page-break-after:avoid; }
.ds-nom { font-size:9.5pt; font-weight:700; color:#e7ecf3; }
.ds-k { font-size:8.6pt; font-weight:800; color:#5fd0a6; white-space:nowrap; }
.meal-macros { display:flex; gap:18px; padding:8px 15px; border-bottom:1px solid #222a36;
  font-size:8.4pt; color:#9aa7b8; background:#151b24; }
.mm i { width:8px; height:8px; border-radius:2px; display:inline-block; margin-right:6px; }
.mm b { color:#f0f4f9; }
.meal-body { display:flex; }
.col-ing { width:42%; padding:12px 15px; border-right:1px solid #222a36; }
.col-elab { width:58%; padding:12px 15px; }
.meal-body h4 { font-size:8pt; text-transform:uppercase; letter-spacing:.08em; color:#5fd0a6; margin-bottom:8px; }
.ings { list-style:none; margin:0; padding:0; }
.ings li { display:flex; justify-content:space-between; gap:9px; padding:4px 0;
  border-bottom:1px solid #1f2731; font-size:9pt; }
.ings li:last-child { border-bottom:none; }
.i-n { color:#e7ecf3; } .i-n em { color:#98a4b4; font-style:normal; font-size:8pt; }
.i-g { font-weight:800; color:#5fd0a6; white-space:nowrap; }
.pasos { margin:0; padding-left:16px; font-size:9pt; color:#dde4ed; }
.pasos li { margin-bottom:6px; padding-left:3px; }
.pasos li::marker { color:#5fd0a6; font-weight:800; }
`;
  // Solo para la ventana de vista previa/impresión (no se usa al generar el archivo)
  const CSS_SCREEN = `@media screen { body { padding:20px 0; } .page { margin:0 auto 16px; box-shadow:0 6px 30px rgba(0,0,0,.5); } }`;

  /** Abre el plan en una ventana lista para "Guardar como PDF" (máxima calidad, texto seleccionable). */
  function exportarPlan(plan, pac, opts) {
    const html = construirHTML(plan, pac, opts);
    const w = window.open("", "_blank");
    if (!w) { NP.util.toast("Permite las ventanas emergentes para generar el PDF"); return null; }
    w.document.open(); w.document.write(html); w.document.close();
    w.onload = () => setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
    return w;
  }

  // ---- Generación del PDF como ARCHIVO (para poder enviarlo) ----
  function cargarLib() {
    return new Promise((res, rej) => {
      if (window.html2pdf) return res();
      const s = document.createElement("script");
      s.src = "js/vendor/html2pdf.bundle.min.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("No se pudo cargar la librería de PDF"));
      document.head.appendChild(s);
    });
  }

  function nombreArchivo(plan, pac) {
    const limpia = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    return `${limpia(plan.nombre) || "Plan"}_${limpia(pac.nombre) || "paciente"}.pdf`;
  }

  /** Genera el PDF y devuelve un Blob. */
  async function generarBlob(plan, pac, opts) {
    await cargarLib();
    const html = construirHTML(plan, pac, opts);
    const doc = new DOMParser().parseFromString(html, "text/html");
    // IMPORTANTE: html2canvas solo captura elementos en el FLUJO normal del documento
    // (fuera de pantalla o con position absolute/fixed devuelve un PDF vacío).
    // Se añade al final del body, tapado por el modal de progreso, y se quita al terminar.
    const cont = document.createElement("div");
    cont.style.cssText = "width:210mm;background:#0b0d12;";
    const st = document.createElement("style");
    st.textContent = CSS; // sin CSS_SCREEN: nada de márgenes ni sombras
    cont.appendChild(st);
    Array.from(doc.body.children).forEach((n) => cont.appendChild(n));
    document.body.appendChild(cont);
    const scrollPrev = window.scrollY;
    const overflowPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    try {
      return await window.html2pdf().set({
        margin: 0,
        filename: nombreArchivo(plan, pac),
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, backgroundColor: "#0b0d12", useCORS: true, logging: false, windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".meal", ".day-head", ".kpi"] },
      }).from(cont).toPdf().output("blob");
    } finally {
      cont.remove();
      document.body.style.overflow = overflowPrev;
      window.scrollTo(0, scrollPrev);
    }
  }

  /**
   * Genera el PDF y lo envía al móvil del paciente.
   * Devuelve "compartido" (hoja nativa: WhatsApp, etc.) o "descargado" (fallback).
   */
  async function enviarAlMovil(plan, pac, opts) {
    const blob = await generarBlob(plan, pac, opts);
    const file = new File([blob], nombreArchivo(plan, pac), { type: "application/pdf" });
    const nombre = (pac.nombre || "").split(" ")[0];
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file], title: plan.nombre,
        text: `Hola ${nombre}, te paso tu plan nutricional.`,
      });
      return "compartido";
    }
    // Fallback: descargar el archivo
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return "descargado";
  }

  /** Flujo completo con interfaz: genera el PDF y lo manda al móvil del paciente. */
  async function flujoEnviarAlMovil(plan, pac, opts) {
    const { el, toast, modal } = NP.util;
    const prog = modal({
      title: "Generando PDF...",
      body: el("div", { class: "loading", style: "height:auto;padding:26px 10px" }, [
        el("div", { class: "spinner" }),
        el("div", { class: "muted" }, "Maquetando el plan de la semana. Puede tardar unos segundos."),
      ]),
    });
    try {
      const r = await enviarAlMovil(plan, pac, opts);
      prog.close();
      if (r === "compartido") { toast("PDF enviado ✓"); return "compartido"; }

      // Fallback (escritorio): PDF descargado -> abrir chat para adjuntar
      const tel = (pac.telefono || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      const nombre = (pac.nombre || "").split(" ")[0];
      const texto = `Hola ${nombre}, te paso tu plan nutricional en PDF.`;
      const m = modal({
        title: "PDF listo ✓",
        body: el("div", {}, [
          el("div", { class: "nota-pdf", style: "margin-bottom:12px" }, [
            el("b", {}, "Descargado: "), nombreArchivo(plan, pac),
          ]),
          el("div", { class: "small muted" },
            "Ahora abre el chat del paciente y adjunta el PDF con el clip 📎. " +
            "WhatsApp no permite que una web adjunte archivos automáticamente. " +
            "Truco: desde el móvil, este mismo botón sí lo envía directo."),
        ]),
        footer: [
          el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cerrar"),
          el("button", {
            class: "btn btn-primary", onclick: () => {
              if (!tel) { toast("Este paciente no tiene teléfono"); return; }
              window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank");
              m.close();
            },
          }, "🟢 Abrir WhatsApp de " + nombre),
        ],
      });
      return "descargado";
    } catch (e) {
      prog.close();
      if (e && e.name === "AbortError") return "cancelado"; // el usuario cerró la hoja de compartir
      NP.util.toast("No se pudo generar el PDF: " + (e.message || e));
      console.error(e);
      return "error";
    }
  }

  const puedeCompartirArchivos = () => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([""], "t.pdf", { type: "application/pdf" })] })); }
    catch (e) { return false; }
  };

  return { exportarPlan, construirHTML, comidaDe, comidasDe, generarBlob, enviarAlMovil,
           flujoEnviarAlMovil, nombreArchivo, puedeCompartirArchivos };
})();
