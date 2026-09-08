# NutriPlan

Aplicación web para planificar menús de nutrición y hacer seguimiento de pacientes.
Funciona en local, sin instalar nada: se abre con **`Abrir NutriPlan.bat`** (necesita Python)
y se ve en `http://localhost:8123`.

## Dos formas de entrar

Al abrir la app se elige el rol:

### 🥗 Nutricionista
Se registra con nombre, email y contraseña. Puede:
- crear y editar pacientes (datos, calculadora de calorías, patologías, notas);
- montar planes semanales con el recetario (3.100+ recetas) y el constructor por ingredientes;
- ver la ficha nutricional completa del plan (macros, minerales, vitaminas frente a las DRI);
- exportar el plan a PDF;
- hablar con cada paciente: dentro de la app, por WhatsApp o por email.

Cada nutricionista ve **solo sus propios pacientes**.

### 🙋 Paciente
Entra con su email y contraseña. Ve:
- **Mi menú** — sus comidas de hoy y la semana completa; al tocar un plato salen los
  ingredientes con sus gramos, la elaboración y la información nutricional. Solo lectura;
- **Mi nutricionista** — chat con su profesional;
- **Mi perfil** — sus datos y objetivo, con opción de actualizar su peso.

## Cómo se le da acceso a un paciente

1. El nutricionista abre la ficha del paciente y pulsa **🔑 Acceso del paciente**.
2. Se genera un código de 6 caracteres (p. ej. `K7M2QP`). Se le puede enviar por WhatsApp
   con el botón del propio panel.
3. El paciente entra en la app, elige **Soy paciente → Es mi primera vez**, escribe el
   código junto con su email y una contraseña, y ya tiene su cuenta creada.

Desde ese mismo panel se puede generar un código nuevo (el anterior deja de valer) o
retirarle el acceso.

## Aviso importante sobre los datos

Todo (cuentas, pacientes, planes y mensajes) se guarda en el **navegador de ese ordenador**
(`localStorage`). No hay servidor ni nube:

- si el paciente entra desde otro ordenador o móvil, no verá nada;
- las contraseñas se guardan como hash con sal, nunca en claro, pero esto **no es un
  sistema de seguridad real**: sirve para separar lo que ve cada persona en un equipo
  compartido, no para proteger datos frente a quien tenga acceso al navegador.

Para que el paciente lo consulte desde su casa haría falta un servidor con base de datos.
Mientras tanto, la vía de siempre —enviarle el plan en PDF por WhatsApp o email— sigue
funcionando desde la pantalla de mensajes.

## Estructura

```
app/
  index.html          arranque y orden de carga de los scripts
  css/styles.css      tema oscuro propio
  data/               recetario.json (recetas) y catalogo.json (BEDCA)
  js/
    util.js           helpers de UI (modales, toasts, creación de nodos)
    nutrition.js      motor de cálculo nutricional
    data.js           carga y búsqueda del recetario y del catálogo
    store.js          persistencia y separación de datos por nutricionista
    auth.js           cuentas, sesión y códigos de acceso
    calorias.js       Harris-Benedict, actividad y macros
    dri.js            ingestas de referencia
    pdf.js            exportación del plan a PDF
    views/
      acceso.js       pantalla de entrada (elegir rol, login, registro)
      pacientes.js    lista y ficha del paciente
      plan.js         editor del plan semanal
      recetas.js      explorador de recetas y componentes compartidos
      constructor.js  constructor por ingredientes
      mensajes.js     mensajería del nutricionista
      cliente.js      vistas del paciente (menú, chat, perfil)
    app.js            router y control de acceso
```

Fuera de `app/` están los scripts de Python con los que se generó y fusionó el recetario
(BEDCA + USDA); no hacen falta para usar la aplicación.
