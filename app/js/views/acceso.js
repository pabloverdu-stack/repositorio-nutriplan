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

  function campo(label, input, ayuda) {
    return el("label", { class: "field" }, [
      el("span", {}, label),
      input,
      ayuda ? el("small", { class: "muted" }, ayuda) : null,
    ]);
  }

  pintarEleccion();
};
