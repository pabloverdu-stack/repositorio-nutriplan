/* documentos.js — PDFs que la nutricionista manda al paciente (rutinas de
   entrenamiento, recetas sugeridas, alimentos sugeridos...).
   Viajan como un mensaje del chat con un campo `adjunto`:
     { nombre, categoria, tam, ruta }  -> en la nube (Supabase Storage)
     { nombre, categoria, tam, data }  -> en local (el PDF en base64 dentro del mensaje) */
NP.docs = (function () {
  const { el, toast, modal } = NP.util;

  const CATEGORIAS = [
    { key: "entreno", ic: "🏋️", tx: "Rutina de entrenamiento" },
    { key: "recetas", ic: "🍲", tx: "Recetas sugeridas" },
    { key: "alimentos", ic: "🥦", tx: "Alimentos sugeridos" },
    { key: "otro", ic: "📄", tx: "Otro documento" },
  ];
  const categoria = (k) => CATEGORIAS.find((c) => c.key === k) || CATEGORIAS[CATEGORIAS.length - 1];

  const enNube = () => !!(NP.nube && NP.nube.activo);
  // En local todo va a localStorage (unos 5 MB en total), así que se limita más
  const maxBytes = () => (enNube() ? 10 : 2) * 1024 * 1024;
  const tamTexto = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

  const leerComoDataURL = (file) => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(file);
  });

  /** Sube el PDF y devuelve el objeto `adjunto` que se guarda en el mensaje */
  async function subir(pacienteId, file, cat) {
    const base = { nombre: file.name, categoria: cat, tam: file.size };
    if (enNube()) {
      const ruta = pacienteId + "/" + NP.util.uid() + ".pdf";
      await NP.nube.subirArchivo(ruta, file);
      return Object.assign(base, { ruta });
    }
    return Object.assign(base, { data: await leerComoDataURL(file) });
  }

  /** Abre el PDF en otra pestaña */
  async function abrir(adj) {
    // Se abre la pestaña ya, dentro del clic, para que el navegador no la bloquee
    const win = window.open("", "_blank");
    try {
      let url;
      if (adj.ruta) url = await NP.nube.urlArchivo(adj.ruta);
      else {
        const blob = await (await fetch(adj.data)).blob();
        url = URL.createObjectURL(blob);
      }
      if (win) win.location.href = url; else location.href = url;
    } catch (e) {
      if (win) win.close();
      console.error("[docs] abrir", e);
      toast("No se ha podido abrir el documento.");
    }
  }

  function borrar(adj) {
    if (adj && adj.ruta && enNube()) NP.nube.borrarArchivo(adj.ruta);
  }

  /** Tarjeta del documento dentro de un mensaje o de una lista */
  function tarjeta(adj) {
    const c = categoria(adj.categoria);
    return el("div", { class: "adjunto", title: "Abrir " + adj.nombre, onclick: () => abrir(adj) }, [
      el("div", { class: "adjunto-ic" }, c.ic),
      el("div", { class: "grow", style: "min-width:0" }, [
        el("div", { class: "adjunto-nm" }, adj.nombre),
        el("div", { class: "small muted" }, c.tx + " · PDF · " + tamTexto(adj.tam || 0)),
      ]),
      el("span", { class: "btn btn-sm", style: "flex:0 0 auto" }, "Abrir"),
    ]);
  }

  /** Diálogo de la nutricionista para mandar un PDF a un paciente */
  function dialogoEnviar(pac, alTerminar) {
    const fArchivo = el("input", { type: "file", accept: "application/pdf,.pdf" });
    const fCat = el("select", {}, CATEGORIAS.map((c) => el("option", { value: c.key }, c.ic + " " + c.tx)));
    const fNota = el("textarea", { rows: 3, placeholder: "Opcional: «Haz esta rutina 3 días por semana», «Te dejo ideas de cenas»..." });
    const err = el("div", { class: "auth-error", hidden: true });
    const btn = el("button", { class: "btn btn-primary" }, "📎 Enviar PDF");

    btn.addEventListener("click", async () => {
      err.hidden = true;
      const file = fArchivo.files && fArchivo.files[0];
      const fallo = (t) => { err.textContent = t; err.hidden = false; };
      if (!file) return fallo("Elige un archivo PDF.");
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return fallo("Solo se pueden enviar archivos PDF.");
      if (file.size > maxBytes())
        return fallo("El PDF ocupa " + tamTexto(file.size) + ". El máximo es " + tamTexto(maxBytes()) +
          (enNube() ? "." : " sin el modo nube (se guarda en este navegador)."));

      btn.disabled = true; btn.textContent = "Enviando...";
      try {
        const adjunto = await subir(pac.id, file, fCat.value);
        const nota = fNota.value.trim();
        NP.store.saveMensaje({
          pacienteId: pac.id, autor: "nutri", canal: "app",
          texto: nota || categoria(fCat.value).ic + " Te he enviado: " + file.name,
          adjunto,
        });
        m.close();
        toast(NP.auth.cuentaDePaciente(pac.id) ? "PDF enviado ✓" : "PDF guardado. Lo verá en cuanto cree su cuenta.");
        NP.app.refrescarNav();
        if (alTerminar) alTerminar();
      } catch (e) {
        console.error("[docs] enviar", e);
        fallo(/quota/i.test(String(e && (e.name + e.message)))
          ? "No queda espacio en este navegador para más PDFs. Activa el modo nube o borra documentos antiguos."
          : "No se ha podido enviar: " + (e.message || e));
        btn.disabled = false; btn.textContent = "📎 Enviar PDF";
      }
    });

    const m = modal({
      title: "Enviar un PDF a " + pac.nombre.split(" ")[0],
      body: el("div", {}, [
        el("label", { class: "field" }, [el("span", {}, "Archivo PDF"), fArchivo,
          el("small", { class: "muted" }, "Máximo " + tamTexto(maxBytes()) + ".")]),
        el("label", { class: "field" }, [el("span", {}, "Tipo de documento"), fCat]),
        el("label", { class: "field" }, [el("span", {}, "Mensaje"), fNota]),
        el("div", { class: "small muted" }, "Le aparecerá en el chat y en su apartado «Mis documentos»."),
        err,
      ]),
      footer: [el("button", { class: "btn btn-ghost", onclick: () => m.close() }, "Cancelar"), btn],
    });
  }

  /** Documentos del paciente agrupados por tipo (lo más reciente primero) */
  function listaAgrupada(pacienteId, vacio) {
    const docs = NP.store.mensajesDe(pacienteId).filter((m) => m.adjunto).reverse();
    if (!docs.length) return vacio;
    return el("div", { class: "docs-grupos" }, CATEGORIAS.map((c) => {
      const deCat = docs.filter((m) => categoria(m.adjunto.categoria).key === c.key);
      if (!deCat.length) return null;
      return el("div", { class: "panel" }, [
        el("div", { class: "side-ttl" }, c.ic + " " + c.tx + " (" + deCat.length + ")"),
        el("div", { class: "docs-lista" }, deCat.map((m) => el("div", {}, [
          tarjeta(m.adjunto),
          el("div", { class: "small muted", style: "margin:4px 2px 0" },
            new Date(m.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) +
            (/^\S+ Te he enviado: /.test(m.texto) ? "" : " · «" + m.texto + "»")),
        ]))),
      ]);
    }));
  }

  return { CATEGORIAS, categoria, tarjeta, abrir, borrar, dialogoEnviar, listaAgrupada };
})();
