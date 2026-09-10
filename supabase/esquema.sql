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

-- PDF adjunto a un mensaje (rutinas, recetas o alimentos sugeridos):
-- { nombre, categoria, tam, ruta }. El archivo vive en Storage.
alter table public.mensajes add column if not exists adjunto jsonb;

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

-- Índices para las consultas que la app hace constantemente.
create index if not exists idx_pacientes_nutri   on public.pacientes (nutri_id);
create index if not exists idx_planes_paciente   on public.planes (paciente_id);
create index if not exists idx_mensajes_paciente on public.mensajes (paciente_id, fecha);


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


-- ---------- Reglas de acceso (Row Level Security) ----------
-- Esta es la parte que de verdad protege los datos: sin ella, cualquiera
-- con la clave pública podría leer las fichas de todos los pacientes.

alter table public.perfiles        enable row level security;
alter table public.pacientes       enable row level security;
alter table public.planes          enable row level security;
alter table public.mensajes        enable row level security;
alter table public.recetas_propias enable row level security;
alter table public.favoritas       enable row level security;

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


-- ---------- Documentos PDF (Storage) ----------
-- Espacio privado. Cada PDF se guarda en «<id del paciente>/<archivo>.pdf»:
-- la primera carpeta dice de qué paciente es, y con eso se decide quién lo ve.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "nutri gestiona documentos" on storage.objects;
create policy "nutri gestiona documentos" on storage.objects
  for all using (
    bucket_id = 'documentos' and exists (
      select 1 from public.pacientes p
       where p.id = (storage.foldername(name))[1] and p.nutri_id = auth.uid()))
  with check (
    bucket_id = 'documentos' and exists (
      select 1 from public.pacientes p
       where p.id = (storage.foldername(name))[1] and p.nutri_id = auth.uid()));

drop policy if exists "paciente lee sus documentos" on storage.objects;
create policy "paciente lee sus documentos" on storage.objects
  for select using (
    bucket_id = 'documentos' and (storage.foldername(name))[1] = public.mi_paciente_id());
