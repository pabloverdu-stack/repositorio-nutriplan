/* views/acceso.js — pantalla de entrada: elegir rol, iniciar sesión y crear cuenta.
   Se pinta a pantalla completa (fuera del #app) mientras no hay sesión. */
NP.views = NP.views || {};

NP.views.acceso = function (root) {
  const { el, toast } = NP.util;

  // rol: null (elegir) | "nutri" | "cliente"   ·   modo: "login" | "registro"
  let rol = null;
  let modo = "login";

  const pantalla = el("div", { class: "auth-screen" });
  root.innerHTML = "";
  root.appendChild(pantalla);

  function marca() {
    return el("div", { class: "auth-brand" }, [
      el("div", { class: "brand-logo grande" }, "◑"),
      el("div", {}, [
        el("div", { class: "auth-name" }, NP.APP_NAME),
        el("div", { class: "small muted" }, "Planes de nutrición y seguimiento"),
      ]),
    ]);
  }

  /* ---------- Paso 1: quién eres ---------- */
  function pintarEleccion() {
    pantalla.innerHTML = "";
    pantalla.appendChild(el("div", { class: "auth-box ancha" }, [
      marca(),
      el("h2", { class: "auth-tit" }, "¿Cómo quieres entrar?"),
      el("div", { class: "auth-roles" }, [
        el("button", {
          class: "rol-card",
          onclick: () => { rol = "nutri"; modo = NP.auth.hayNutricionistas() ? "login" : "registro"; pintarForm(); },
        }, [
          el("div", { class: "rol-ic" }, "🥗"),
          el("div", { class: "rol-tit" }, "Soy nutricionista"),
          el("div", { class: "rol-tx" }, "Gestiona tus pacientes, crea sus planes y habla con ellos."),
        ]),
        el("button", {
          class: "rol-card",
          onclick: () => { rol = "cliente"; modo = "login"; pintarForm(); },
        }, [
          el("div", { class: "rol-ic" }, "🙋"),
          el("div", { class: "rol-tit" }, "Soy paciente"),
          el("div", { class: "rol-tx" }, "Consulta tus menús de la semana y escribe a tu nutricionista."),
        ]),
      ]),
      el("div", { class: "auth-pie" }, [
        "Los datos se guardan en este navegador. ",
        el("b", {}, "No es una nube:"),
        " si usas otro ordenador, no verás lo de aquí.",
      ]),
    ]));
  }

  /* ---------- Paso 2: entrar o crear cuenta ---------- */
  function pintarForm() {
    const esNutri = rol === "nutri";
    const registro = modo === "registro";

    const fNombre = el("input", { placeholder: "Nombre y apellidos", autocomplete: "name" });
    const fCodigo = el("input", { placeholder: "Ej. K7M2QP", maxlength: 8, style: "text-transform:uppercase;letter-spacing:.16em;font-weight:700" });
    const fEmail = el("input", { type: "email", placeholder: "tucorreo@email.com", autocomplete: "email" });
    const fPass = el("input", { type: "password", placeholder: registro ? "Mínimo 6 caracteres" : "Tu contraseña", autocomplete: registro ? "new-password" : "current-password" });
    const fPass2 = el("input", { type: "password", placeholder: "Repite la contraseña", autocomplete: "new-password" });
    const error = el("div", { class: "auth-error", hidden: true });
    const btn = el("button", { class: "btn btn-primary grande", type: "submit" }, registro ? "Crear cuenta" : "Entrar");

    const fallo = (msg) => { error.textContent = msg; error.hidden = false; };

    async function enviar(e) {
      e.preventDefault();
      error.hidden = true;
      btn.disabled = true;
      try {
        let u;
        if (!registro) {
          u = await NP.auth.login({ email: fEmail.value, pass: fPass.value, rol });
        } else if (esNutri) {
          if (fPass.value !== fPass2.value) throw new Error("Las dos contraseñas no coinciden.");
          u = await NP.auth.registrarNutri({ nombre: fNombre.value, email: fEmail.value, pass: fPass.value });
          await NP.auth.login({ email: fEmail.value, pass: fPass.value, rol: "nutri" });
        } else {
          if (fPass.value !== fPass2.value) throw new Error("Las dos contraseñas no coinciden.");
          u = await NP.auth.registrarCliente({ codigo: fCodigo.value, email: fEmail.value, pass: fPass.value });
          await NP.auth.login({ email: fEmail.value, pass: fPass.value, rol: "cliente" });
        }
        toast(registro ? "Cuenta creada. ¡Bienvenido/a!" : "Hola de nuevo, " + (u.nombre || "").split(" ")[0]);
        NP.app.entrarEnLaApp();
      } catch (err) {
        fallo(err.message || "No se ha podido completar.");
        btn.disabled = false;
      }
    }

    const campos = [];
    if (registro && esNutri) campos.push(campo("Tu nombre", fNombre));
    if (registro && !esNutri) campos.push(campo("Código de acceso", fCodigo,
      "Es el código de 6 letras y números que te ha dado tu nutricionista."));
    campos.push(campo("Email", fEmail));
    campos.push(campo("Contraseña", fPass));
    if (registro) campos.push(campo("Repetir contraseña", fPass2));

    const form = el("form", { class: "auth-form", onsubmit: enviar }, campos.concat([error, btn]));

    const olvide = registro ? null : el("button", {
      class: "btn btn-ghost", type: "button", style: "margin-top:8px;width:100%;justify-content:center;font-size:12.5px",
      onclick: () => pintarRecuperar(fEmail.value),
    }, "¿Has olvidado tu contraseña?");

    const cambiarModo = el("button", {
      class: "btn btn-ghost", type: "button",
      onclick: () => { modo = registro ? "login" : "registro"; pintarForm(); },
    }, registro ? "Ya tengo cuenta · Entrar" : (esNutri ? "No tengo cuenta · Registrarme" : "Es mi primera vez · Crear mi cuenta"));

    pantalla.innerHTML = "";
    pantalla.appendChild(el("div", { class: "auth-box" }, [
      marca(),
      el("div", { class: "auth-rol-pill" }, esNutri ? "🥗 Nutricionista" : "🙋 Paciente"),
      el("h2", { class: "auth-tit" }, registro
        ? (esNutri ? "Crea tu cuenta de nutricionista" : "Crea tu cuenta de paciente")
        : (esNutri ? "Entrar como nutricionista" : "Entrar como paciente")),
      form,
      olvide,
      el("div", { class: "auth-acciones" }, [
        cambiarModo,
        el("button", { class: "btn btn-ghost", type: "button", onclick: () => { rol = null; pintarEleccion(); } }, "← Cambiar de rol"),
      ]),
      !esNutri && !registro
        ? el("div", { class: "auth-pie" }, "¿Aún no tienes cuenta? Pídele a tu nutricionista tu código de acceso y pulsa «Crear mi cuenta».")
        : null,
      esNutri && registro && !NP.auth.hayNutricionistas()
        ? el("div", { class: "auth-pie" }, "Serás la primera cuenta: los pacientes que ya tuvieras guardados en este navegador pasarán a tu cuenta.")
        : null,
    ]));
    (registro && esNutri ? fNombre : registro && !esNutri ? fCodigo : fEmail).focus();
  }

  /* ---------- ¿Has olvidado tu contraseña? ---------- */
  function pintarRecuperar(emailPrevio) {
    const esNutri = rol === "nutri";
    const enNube = !!(NP.nube && NP.nube.activo);
    const volver = el("button", { class: "btn btn-ghost", type: "button", onclick: () => { modo = "login"; pintarForm(); } }, "← Volver a entrar");
    let contenido;

    if (enNube) {
      const fEmail = el("input", { type: "email", placeholder: "tucorreo@email.com", autocomplete: "email", value: emailPrevio || "" });
      const error = el("div", { class: "auth-error", hidden: true });
      const btn = el("button", { class: "btn btn-primary grande", type: "submit" }, "Enviarme el enlace");
      const form = el("form", {
        class: "auth-form",
        onsubmit: async (e) => {
          e.preventDefault();
          error.hidden = true; btn.disabled = true;
          try {
            await NP.auth.recuperarPass(fEmail.value);
            form.replaceWith(el("div", { class: "auth-pie", style: "font-size:13px;color:var(--text)" }, [
              "✉️ Si hay una cuenta con ", el("b", {}, fEmail.value.trim()),
              ", te llegará un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
            ]));
          } catch (err) {
            error.textContent = err.message || "No se ha podido enviar el correo.";
            error.hidden = false; btn.disabled = false;
          }
        },
      }, [
        el("p", { class: "small muted", style: "margin:0 0 14px" }, "Escribe el email de tu cuenta y te mandaremos un enlace para poner una contraseña nueva."),
        campo("Email", fEmail), error, btn,
      ]);
      contenido = form;
      setTimeout(() => fEmail.focus(), 0);
    } else {
      // Modo local: no hay servidor que pueda mandar correos
      contenido = el("div", { class: "auth-pie", style: "font-size:13px;color:var(--text)" }, esNutri
        ? ["Los datos se guardan solo en este navegador, así que no hay forma de enviarte un correo de recuperación. ",
           "Si activas el modo nube (config.js con Supabase), podrás recuperarla por email."]
        : ["Pídele a tu nutricionista que te ", el("b", {}, "reinicie el acceso"),
           " desde tu ficha. Te dará un código nuevo y podrás crear tu cuenta otra vez con «Es mi primera vez»."]);
    }

    pantalla.innerHTML = "";
    pantalla.appendChild(el("div", { class: "auth-box" }, [
      marca(),
      rol ? el("div", { class: "auth-rol-pill" }, esNutri ? "🥗 Nutricionista" : "🙋 Paciente") : null,
      el("h2", { class: "auth-tit" }, "Recuperar contraseña"),
      contenido,
      el("div", { class: "auth-acciones" }, [volver]),
    ]));
  }

  /* ---------- Llegada desde el enlace del correo: poner la nueva ---------- */
  function pintarNuevaPass() {
    const f1 = el("input", { type: "password", placeholder: "Mínimo 6 caracteres", autocomplete: "new-password" });
    const f2 = el("input", { type: "password", placeholder: "Repite la contraseña", autocomplete: "new-password" });
    const error = el("div", { class: "auth-error", hidden: true });
    const btn = el("button", { class: "btn btn-primary grande", type: "submit" }, "Guardar y entrar");
    const form = el("form", {
      class: "auth-form",
      onsubmit: async (e) => {
        e.preventDefault();
        error.hidden = true; btn.disabled = true;
        try {
          if (f1.value !== f2.value) throw new Error("Las dos contraseñas no coinciden.");
          const u = await NP.auth.nuevaPass(f1.value);
          toast("Contraseña cambiada ✓ Hola, " + (u.nombre || "").split(" ")[0]);
          NP.app.entrarEnLaApp();
        } catch (err) {
          error.textContent = err.message || "No se ha podido cambiar.";
          error.hidden = false; btn.disabled = false;
        }
      },
    }, [campo("Nueva contraseña", f1), campo("Repetir contraseña", f2), error, btn]);

    pantalla.innerHTML = "";
    pantalla.appendChild(el("div", { class: "auth-box" }, [
      marca(),
      el("h2", { class: "auth-tit" }, "Crea tu nueva contraseña"),
      form,
      el("div", { class: "auth-acciones" }, [
        el("button", { class: "btn btn-ghost", type: "button", onclick: () => { NP.auth.cancelarRecuperacion(); pintarEleccion(); } }, "Cancelar"),
      ]),
    ]));
    f1.focus();
  }

  function campo(label, input, ayuda) {
    return el("label", { class: "field" }, [
      el("span", {}, label),
      input,
      ayuda ? el("small", { class: "muted" }, ayuda) : null,
    ]);
  }

  if (NP.auth.enRecuperacion && NP.auth.enRecuperacion()) pintarNuevaPass();
  else pintarEleccion();
};
