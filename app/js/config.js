/* config.js — conexión con la base de datos en la nube (Supabase)
   ----------------------------------------------------------------
   Pega aquí los dos datos de tu proyecto y la app pasará a guardar
   en la nube: una sola cuenta para ti, accesible desde cualquier
   dispositivo, y tus pacientes viendo sus menús desde su móvil.

   Dónde encontrarlos: panel de Supabase -> Project Settings -> API Keys
     · Project URL      -> algo como https://abcdefgh.supabase.co
     · Clave "anon public"

   La clave `anon` es pública por diseño: viaja dentro de esta página y
   la puede leer cualquiera. No pasa nada, porque quien manda son las
   reglas de acceso de la base de datos (supabase/esquema.sql).
   La clave `service_role` NO se pone aquí nunca: esa se salta todas
   las reglas y daría acceso a los datos de todos los pacientes.

   Si se dejan vacíos, la app funciona como siempre: guardando en este
   navegador y sin compartir nada entre dispositivos. */
window.NP = window.NP || {};
NP.config = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
