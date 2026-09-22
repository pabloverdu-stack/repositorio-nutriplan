-- ============================================================
--  NutriPlan · esquema de la base de datos (Supabase / PostgreSQL)
--  ------------------------------------------------------------
--  Cómo usarlo: en tu proyecto de Supabase abre el "SQL Editor",
--  pega TODO este archivo y pulsa "Run".
--  Se puede ejecutar más de una vez sin romper nada.
--
--  Las fichas, planes y recetas se guardan en columnas `datos` de
--  tipo jsonb: son los mismos objetos que la app ya manejaba en el
--  navegador, así no hay que mapear campo por campo ni tocar la
--  base de datos cada vez que se añade un dato nuevo a una ficha.
--
--  Los identificadores son `text` y no `uuid` a propósito: así se
--  conservan tal cual los ids que la app ya venía generando, y los
--  planes siguen apuntando a sus recetas sin tener que reescribirlos.
-- ============================================================

-- ---------- Tablas ----------

-- Un perfil por cada usuario registrado. Dice si es nutricionista o
-- paciente, y en el segundo caso a qué ficha está asociado.
create table if not exists public.perfiles (
  id          uuid primary key references auth.users on delete cascade,
  rol         text not null check (rol in ('nutri', 'cliente')),
  nombre      text not null default '',
  paciente_id text,
  creado      timestamptz not null default now()
);

-- Fichas de paciente. `nutri_id` es el dueño: quien la creó.
create table if not exists public.pacientes (
  id            text primary key default gen_random_uuid()::text,
  nutri_id      uuid not null references auth.users on delete cascade,
  codigo_acceso text unique,
  cuenta_creada boolean not null default false,
  cuenta_email  text,
  datos         jsonb not null default '{}'::jsonb,
  creado        timestamptz not null default now()
);

-- El perfil del paciente apunta a su ficha (se declara aquí porque la
-- tabla `pacientes` todavía no existía al crear `perfiles`).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_paciente_fk') then
    alter table public.perfiles
      add constraint perfiles_paciente_fk
      foreign key (paciente_id) references public.pacientes(id) on delete set null;
  end if;
end $$;

-- Planes semanales. `datos` guarda la rejilla de días y comidas.
create table if not exists public.planes (
  id          text primary key default gen_random_uuid()::text,
  paciente_id text not null references public.pacientes on delete cascade,
  nombre      text not null default 'Plan',
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now()
);

-- Chat entre el nutricionista y el paciente.
create table if not exists public.mensajes (
  id          text primary key default gen_random_uuid()::text,
  paciente_id text not null references public.pacientes on delete cascade,
  autor       text not null check (autor in ('nutri', 'paciente')),
  texto       text not null,
  canal       text not null default 'app',
  leido       boolean not null default false,
  fecha       timestamptz not null default now()
);

-- Recetas creadas por el propio nutricionista.
create table if not exists public.recetas_propias (
  id       text primary key,
  nutri_id uuid not null references auth.users on delete cascade,
  datos    jsonb not null default '{}'::jsonb,
  creado   timestamptz not null default now()
);

-- Recetas del recetario general marcadas como favoritas.
create table if not exists public.favoritas (
  nutri_id  uuid not null references auth.users on delete cascade,
  receta_id text not null,
  primary key (nutri_id, receta_id)
);

-- PDF que el nutricionista le manda al paciente (rutinas de entrenamiento,
-- ideas de recetas, guías...). El archivo va en el almacén "documentos"
-- (Storage) y aquí queda la ficha de cada envío. Si el mismo PDF se manda
-- a varios pacientes hay una fila por paciente, todas con la misma `ruta`.
create table if not exists public.documentos (
  id          text primary key default gen_random_uuid()::text,
  paciente_id text not null references public.pacientes on delete cascade,
  nutri_id    uuid not null references auth.users on delete cascade,
  titulo      text not null,
  categoria   text not null default 'otros',
  nota        text not null default '',
  ruta        text not null,          -- <nutri_id>/<id>.pdf dentro del almacén
  archivo     text,                   -- nombre original, para la descarga
  tamano      bigint,
  visto       boolean not null default false,
  fecha       timestamptz not null default now()
);

-- Todo lo que se va anotando de un paciente a lo largo del seguimiento:
-- revisiones (peso, pliegues y perímetros), fotos de progreso, rutinas de
-- entrenamiento, el registro de actividad que apunta el propio paciente, las
-- citas y las alternativas de alimentos. Van en una sola tabla porque se
-- guardan y se consultan igual; `tipo` dice qué es y `datos` lleva sus campos.
create table if not exists public.registros (
  id          text primary key default gen_random_uuid()::text,
  paciente_id text not null references public.pacientes on delete cascade,
  tipo        text not null,
  fecha       text not null default '',   -- ISO (2026-09-18 o 2026-09-18T10:30), para ordenar
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now()
);
-- Los tipos admitidos van aparte para poder añadir nuevos en una base ya creada.
-- «diario» es el día a día del paciente: el agua que bebe y las comidas que marca como hechas.
alter table public.registros drop constraint if exists registros_tipo_check;
alter table public.registros add constraint registros_tipo_check
  check (tipo in ('revision', 'foto', 'rutina', 'actividad', 'cita', 'alternativa', 'diario'));

-- Índices para las consultas que la app hace constantemente.
create index if not exists idx_pacientes_nutri   on public.pacientes (nutri_id);
create index if not exists idx_planes_paciente   on public.planes (paciente_id);
create index if not exists idx_mensajes_paciente on public.mensajes (paciente_id, fecha);
create index if not exists idx_documentos_paciente on public.documentos (paciente_id, fecha);
create index if not exists idx_registros_paciente on public.registros (paciente_id, tipo, fecha);

-- Almacén privado de los PDF: solo PDF y como mucho 20 MB cada uno.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Almacén privado de las fotos de progreso: imágenes de hasta 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------- Funciones auxiliares ----------
-- Van con SECURITY DEFINER a propósito: se saltan las reglas de acceso
-- para poder consultar el propio perfil sin caer en una recursión
-- infinita, ya que esas mismas reglas las usan.

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.mi_paciente_id() returns text
language sql stable security definer set search_path = public as $$
  select paciente_id from public.perfiles where id = auth.uid();
$$;

create or replace function public.mi_nutri_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.nutri_id
    from public.pacientes p
    join public.perfiles pe on pe.paciente_id = p.id
   where pe.id = auth.uid();
$$;

-- Canje del código de acceso: el paciente ya se ha registrado y ahora
-- reclama su ficha. Necesita SECURITY DEFINER porque tiene que buscar
-- entre todas las fichas, algo que las reglas de acceso le prohíben.
create or replace function public.canjear_codigo(codigo text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pid   text;
  nom   text;
  email text;
begin
  select id, coalesce(datos->>'nombre', '')
    into pid, nom
    from public.pacientes
   where codigo_acceso = upper(btrim(codigo));

  if pid is null then
    raise exception 'CODIGO_INVALIDO';
  end if;

  if exists (select 1 from public.perfiles where paciente_id = pid) then
    raise exception 'YA_TIENE_CUENTA';
  end if;

  select u.email into email from auth.users u where u.id = auth.uid();

  insert into public.perfiles (id, rol, nombre, paciente_id)
       values (auth.uid(), 'cliente', nom, pid)
  on conflict (id) do update
          set rol = 'cliente', paciente_id = pid, nombre = excluded.nombre;

  -- Se marca en la ficha para que el nutricionista vea que ya tiene cuenta
  update public.pacientes
     set cuenta_creada = true, cuenta_email = email
   where id = pid;

  return pid;
end;
$$;

-- Comprobación previa del código, antes de crear la cuenta: así no quedan
-- cuentas huérfanas si el paciente escribe mal el código.
-- Devuelve 'LIBRE', 'OCUPADO' o 'NO_EXISTE'.
create or replace function public.codigo_disponible(codigo text)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.pacientes
                      where codigo_acceso = upper(btrim(codigo))) then 'NO_EXISTE'
    when exists (select 1 from public.perfiles pe
                   join public.pacientes p on p.id = pe.paciente_id
                  where p.codigo_acceso = upper(btrim(codigo))) then 'OCUPADO'
    else 'LIBRE'
  end;
$$;

grant execute on function public.codigo_disponible(text) to anon, authenticated;

-- Retirar el acceso a un paciente: desliga su perfil de la ficha. La
-- cuenta de correo sigue existiendo, pero deja de ver nada.
create or replace function public.revocar_acceso(p_paciente_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pacientes
                  where id = p_paciente_id and nutri_id = auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.perfiles set paciente_id = null where paciente_id = p_paciente_id;
  update public.pacientes
     set cuenta_creada = false, cuenta_email = null
   where id = p_paciente_id;
end;
$$;

-- El paciente marca como visto un documento suyo. Va por función para que
-- solo pueda tocar esa casilla y no el título, la nota o el archivo.
create or replace function public.marcar_documento_visto(p_id text)
returns void
language sql security definer set search_path = public as $$
  update public.documentos
     set visto = true
   where id = p_id and paciente_id = public.mi_paciente_id();
$$;


-- ---------- Reglas de acceso (Row Level Security) ----------
-- Esta es la parte que de verdad protege los datos: sin ella, cualquiera
-- con la clave pública podría leer las fichas de todos los pacientes.

alter table public.perfiles        enable row level security;
alter table public.pacientes       enable row level security;
alter table public.planes          enable row level security;
alter table public.mensajes        enable row level security;
alter table public.recetas_propias enable row level security;
alter table public.favoritas       enable row level security;
alter table public.documentos      enable row level security;
alter table public.registros       enable row level security;

-- Perfiles: cada uno el suyo; el paciente además ve el de su
-- nutricionista, porque necesita su nombre para el chat.
drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for select using (id = auth.uid() or id = public.mi_nutri_id());

drop policy if exists "crear mi perfil" on public.perfiles;
create policy "crear mi perfil" on public.perfiles
  for insert with check (id = auth.uid());

drop policy if exists "editar mi perfil" on public.perfiles;
create policy "editar mi perfil" on public.perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Pacientes: el nutricionista manda sobre los suyos; el paciente solo
-- lee y actualiza su propia ficha.
drop policy if exists "nutri gestiona sus pacientes" on public.pacientes;
create policy "nutri gestiona sus pacientes" on public.pacientes
  for all using (nutri_id = auth.uid()) with check (nutri_id = auth.uid());

drop policy if exists "paciente ve su ficha" on public.pacientes;
create policy "paciente ve su ficha" on public.pacientes
  for select using (id = public.mi_paciente_id());

drop policy if exists "paciente actualiza su ficha" on public.pacientes;
create policy "paciente actualiza su ficha" on public.pacientes
  for update using (id = public.mi_paciente_id()) with check (id = public.mi_paciente_id());

-- Planes: los gestiona el nutricionista dueño del paciente; el paciente
-- solo los lee.
drop policy if exists "nutri gestiona planes" on public.planes;
create policy "nutri gestiona planes" on public.planes
  for all using (exists (select 1 from public.pacientes p
                          where p.id = planes.paciente_id and p.nutri_id = auth.uid()))
      with check (exists (select 1 from public.pacientes p
                          where p.id = planes.paciente_id and p.nutri_id = auth.uid()));

drop policy if exists "paciente ve sus planes" on public.planes;
create policy "paciente ve sus planes" on public.planes
  for select using (paciente_id = public.mi_paciente_id());

-- Mensajes: los dos lados del hilo. El paciente solo puede escribir
-- mensajes firmados como suyos.
drop policy if exists "nutri en sus hilos" on public.mensajes;
create policy "nutri en sus hilos" on public.mensajes
  for all using (exists (select 1 from public.pacientes p
                          where p.id = mensajes.paciente_id and p.nutri_id = auth.uid()))
      with check (exists (select 1 from public.pacientes p
                          where p.id = mensajes.paciente_id and p.nutri_id = auth.uid()));

drop policy if exists "paciente lee su hilo" on public.mensajes;
create policy "paciente lee su hilo" on public.mensajes
  for select using (paciente_id = public.mi_paciente_id());

drop policy if exists "paciente escribe" on public.mensajes;
create policy "paciente escribe" on public.mensajes
  for insert with check (paciente_id = public.mi_paciente_id() and autor = 'paciente');

drop policy if exists "paciente marca leidos" on public.mensajes;
create policy "paciente marca leidos" on public.mensajes
  for update using (paciente_id = public.mi_paciente_id());

-- Recetas propias y favoritas: privadas de cada nutricionista.
drop policy if exists "mis recetas" on public.recetas_propias;
create policy "mis recetas" on public.recetas_propias
  for all using (nutri_id = auth.uid()) with check (nutri_id = auth.uid());

drop policy if exists "mis favoritas" on public.favoritas;
create policy "mis favoritas" on public.favoritas
  for all using (nutri_id = auth.uid()) with check (nutri_id = auth.uid());

-- Documentos: el nutricionista los gestiona (solo para sus pacientes);
-- el paciente solo lee los suyos (el "visto" lo marca con la función).
drop policy if exists "nutri gestiona documentos" on public.documentos;
create policy "nutri gestiona documentos" on public.documentos
  for all using (nutri_id = auth.uid())
      with check (nutri_id = auth.uid()
                  and exists (select 1 from public.pacientes p
                               where p.id = documentos.paciente_id and p.nutri_id = auth.uid()));

drop policy if exists "paciente ve sus documentos" on public.documentos;
create policy "paciente ve sus documentos" on public.documentos
  for select using (paciente_id = public.mi_paciente_id());

-- Registros del seguimiento: los gestiona el nutricionista dueño del paciente.
-- El paciente lee todos los suyos y además puede anotar su entrenamiento, subir
-- fotos y apuntar su peso (revisiones marcadas como suyas); las revisiones del
-- nutricionista, las rutinas y las citas solo las toca él.
drop policy if exists "nutri gestiona registros" on public.registros;
create policy "nutri gestiona registros" on public.registros
  for all using (exists (select 1 from public.pacientes p
                          where p.id = registros.paciente_id and p.nutri_id = auth.uid()))
      with check (exists (select 1 from public.pacientes p
                          where p.id = registros.paciente_id and p.nutri_id = auth.uid()));

drop policy if exists "paciente ve sus registros" on public.registros;
create policy "paciente ve sus registros" on public.registros
  for select using (paciente_id = public.mi_paciente_id());

-- Lo que el paciente puede anotar por su cuenta
create or replace function public.registro_del_paciente(p_tipo text, p_datos jsonb)
returns boolean
language sql immutable as $$
  select p_tipo in ('actividad', 'foto', 'diario')
      or (p_tipo = 'revision' and p_datos->>'origen' = 'paciente');
$$;

drop policy if exists "paciente anota lo suyo" on public.registros;
create policy "paciente anota lo suyo" on public.registros
  for insert with check (paciente_id = public.mi_paciente_id()
                         and public.registro_del_paciente(tipo, datos));

drop policy if exists "paciente edita lo suyo" on public.registros;
create policy "paciente edita lo suyo" on public.registros
  for update using (paciente_id = public.mi_paciente_id()
                    and public.registro_del_paciente(tipo, datos))
      with check (paciente_id = public.mi_paciente_id()
                  and public.registro_del_paciente(tipo, datos));

drop policy if exists "paciente borra lo suyo" on public.registros;
create policy "paciente borra lo suyo" on public.registros
  for delete using (paciente_id = public.mi_paciente_id()
                    and public.registro_del_paciente(tipo, datos));

-- Archivos del almacén "documentos". Cada nutricionista sube a su carpeta
-- (<su id>/...) y solo toca esa; el paciente puede leer un archivo solo si
-- tiene una ficha de documento que apunte a él.
drop policy if exists "nutriplan: nutri gestiona sus pdf" on storage.objects;
create policy "nutriplan: nutri gestiona sus pdf" on storage.objects
  for all using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "nutriplan: paciente lee sus pdf" on storage.objects;
create policy "nutriplan: paciente lee sus pdf" on storage.objects
  for select using (
    bucket_id = 'documentos'
    and exists (select 1 from public.documentos d
                 where d.ruta = objects.name and d.paciente_id = public.mi_paciente_id()));

-- Fotos de progreso. Van en una carpeta por paciente (<paciente_id>/...): el
-- nutricionista entra en las de sus pacientes y cada paciente solo en la suya.
drop policy if exists "nutriplan: nutri gestiona fotos" on storage.objects;
create policy "nutriplan: nutri gestiona fotos" on storage.objects
  for all using (
    bucket_id = 'fotos'
    and exists (select 1 from public.pacientes p
                 where p.id = (storage.foldername(name))[1] and p.nutri_id = auth.uid()))
  with check (
    bucket_id = 'fotos'
    and exists (select 1 from public.pacientes p
                 where p.id = (storage.foldername(name))[1] and p.nutri_id = auth.uid()));

drop policy if exists "nutriplan: paciente ve sus fotos" on storage.objects;
create policy "nutriplan: paciente ve sus fotos" on storage.objects
  for select using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_paciente_id());

drop policy if exists "nutriplan: paciente sube sus fotos" on storage.objects;
create policy "nutriplan: paciente sube sus fotos" on storage.objects
  for insert with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_paciente_id());

drop policy if exists "nutriplan: paciente borra sus fotos" on storage.objects;
create policy "nutriplan: paciente borra sus fotos" on storage.objects
  for delete using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_paciente_id());
