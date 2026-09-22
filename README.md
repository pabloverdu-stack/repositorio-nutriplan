# NutriPlan

Aplicación web para planificar menús de nutrición y hacer seguimiento de pacientes.
Funciona en local, sin instalar nada: se abre con **`Abrir NutriPlan.bat`** (necesita Python)
y se ve en `http://localhost:8123`.

## Dos formas de entrar

Al abrir la app se elige el rol:

### 🥗 Nutricionista
Se registra con nombre, email y contraseña. Puede:
- crear y editar pacientes (datos, calculadora de calorías, patologías, notas);
- montar planes de dos formas, la que prefiera para cada paciente:
  - **semana completa**: la rejilla de 7 días con el recetario (3.100+ recetas) y el constructor
    por ingredientes, con sus kcal y macros calculados;
  - **menú por opciones**: bloques de días («días de entrenamiento», «días de descanso»...) y,
    en cada comida, varias opciones equivalentes entre las que el paciente elige cada día,
    con sus alimentos y gramos, la preparación y la suplementación;
- ver la ficha nutricional completa del plan (macros, minerales, vitaminas frente a las DRI);
- exportar el plan a PDF;
- enviarle PDF (rutinas de entrenamiento, ideas de recetas, guías...) desde
  **📂 Documentos** en la ficha del paciente; el mismo PDF se puede mandar a varios
  pacientes a la vez y se ve quién lo ha abierto ya;
- llevar el seguimiento en **📈 Revisiones**: peso, los **7 pliegues cutáneos** (la app
  calcula sola el % de grasa con Jackson-Pollock + Siri), perímetros, masa grasa y magra,
  gráfica de progresión de peso y grasa, y **fotos** de cada revisión para compararlas
  lado a lado;
- montar su **🏋️ entrenamiento**: rutina por días con sus ejercicios, series,
  repeticiones, peso y descanso; el paciente la ve en su móvil y apunta lo que levanta,
  y aquí se ve su progresión de cargas ejercicio por ejercicio;
- poner **🗓️ citas y revisiones** en la agenda (calendario mensual, con aviso automático
  al paciente por el chat);
- dejarle **🥗 recetas y alternativas**: por qué puede cambiar cada alimento cuando se
  canse de algo del plan, y recetas del recetario recomendadas;
- hablar con cada paciente: dentro de la app, por WhatsApp o por email.

Cada nutricionista ve **solo sus propios pacientes**.

### 🙋 Paciente
Entra con su email y contraseña. Ve:
- **Mi menú** — según cómo se lo haya montado su nutricionista: sus comidas de hoy y la semana
  completa (al tocar un plato salen los ingredientes con sus gramos, la elaboración y la
  información nutricional), o las opciones de cada comida para elegir cada día. Solo lectura,
  y con botón para descargarlo en PDF;
- **Mi entreno** — su rutina día a día y el botón para registrar cada sesión (repeticiones
  y kilos de cada serie, con lo que hizo la vez anterior ya puesto), más su progresión;
- **Mi progreso** — gráfica de peso y grasa corporal, historial de revisiones, sus fotos
  y el botón para anotar su peso;
- **Mis recetas** — las alternativas de alimentos y las recetas que le recomienda su
  nutricionista;
- **Mi agenda** — su próxima cita y el calendario del mes;
- **Mis documentos** — los PDF que le manda su nutricionista, ordenados por tipo
  (entrenamiento, recetas, guías, otros), con aviso de los nuevos; se abren o descargan
  desde el móvil;
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
    antropo.js        pliegues (Jackson-Pollock 7) y composición corporal
    grafica.js        gráficas de líneas en SVG (progresión)
    dri.js            ingestas de referencia
    pdf.js            exportación del plan a PDF
    views/
      acceso.js       pantalla de entrada (elegir rol, login, registro)
      pacientes.js    lista y ficha del paciente
      plan.js         editor del plan semanal
      menu.js         editor y vista del menú por opciones
      recetas.js      explorador de recetas y componentes compartidos
      constructor.js  constructor por ingredientes
      mensajes.js     mensajería del nutricionista
      documentos.js   PDF del nutricionista al paciente (envío y «Mis documentos»)
      revisiones.js   revisiones, pliegues, gráfica de progresión y fotos
      entreno.js      rutinas de entrenamiento y registro de actividad
      agenda.js       calendario de citas y revisiones
      alternativas.js recetas sanas y cambios de alimentos por paciente
      cliente.js      vistas del paciente (menú, chat, perfil)
    app.js            router y control de acceso
```

Fuera de `app/` están los scripts de Python con los que se generó y fusionó el recetario
(BEDCA + USDA); no hacen falta para usar la aplicación.
