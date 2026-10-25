-- ============================================================
-- Recompras Mercado Digital: base de datos
-- Pegar completo en Supabase > SQL Editor > New query > Run
-- ============================================================

-- Perfiles: cada persona que crea su usuario queda "pendiente"
-- hasta que un administrador la aprueba.
create table if not exists public.perfiles (
  id      uuid primary key references auth.users on delete cascade,
  email   text,
  nombre  text default '',
  rol     text not null default 'pendiente' check (rol in ('pendiente', 'usuario', 'admin')),
  creado  timestamptz not null default now()
);

create or replace function public.nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

create or replace function public.es_usuario()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('usuario', 'admin'));
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Pedidos: una fila por pedido del Excel del admin
create table if not exists public.pedidos (
  id          bigserial primary key,
  num_pedido  text unique,
  fecha       timestamptz not null,
  cliente     text not null default '',
  telefono    text not null default '',
  vendedor    text not null default '',
  categoria   text not null default '',
  marca       text not null default '',
  productos   jsonb not null default '[]',   -- [[cantidad, nombre, variante], ...]
  total       numeric not null default 0,
  canal       text not null default 'Mercado Digital',
  cargado     timestamptz not null default now()
);
create index if not exists pedidos_telefono on public.pedidos (telefono);
create index if not exists pedidos_fecha on public.pedidos (fecha);

-- Ciclos: cuánto dura cada producto consumible
create table if not exists public.ciclos (
  id      bigserial primary key,
  match   text not null,
  nombre  text not null,
  dias    int not null check (dias > 0)
);
insert into public.ciclos (match, nombre, dias)
select * from (values
  ('skincare', 'Skincare', 40), ('belleza', 'Belleza y salud', 40), ('perfume', 'Perfumes', 90),
  ('tintas', 'Tintas', 30), ('toners', 'Toners', 60)
) v(match, nombre, dias)
where not exists (select 1 from public.ciclos);

-- Clientes a los que ya se les ofreció
create table if not exists public.ofrecidos (
  telefono  text primary key,
  fecha     timestamptz not null default now(),
  producto  text default '',
  por       uuid references auth.users on delete set null
);

-- Registro de consultas a la IA (control de costo)
create table if not exists public.consultas_ia (
  id          bigserial primary key,
  usuario     uuid references auth.users on delete set null,
  tipo        text,
  tokens_in   int,
  tokens_out  int,
  creado      timestamptz not null default now()
);

-- ============================================================
-- Seguridad: nadie ve datos de clientes sin estar aprobado
-- ============================================================
alter table public.perfiles     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.ciclos       enable row level security;
alter table public.ofrecidos    enable row level security;
alter table public.consultas_ia enable row level security;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select using (id = auth.uid() or public.es_admin());
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update using (public.es_admin()) with check (public.es_admin());
drop policy if exists perfiles_borrar on public.perfiles;
create policy perfiles_borrar on public.perfiles for delete using (public.es_admin());

drop policy if exists pedidos_ver on public.pedidos;
create policy pedidos_ver on public.pedidos for select using (public.es_usuario());
drop policy if exists pedidos_cargar on public.pedidos;
create policy pedidos_cargar on public.pedidos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists ciclos_ver on public.ciclos;
create policy ciclos_ver on public.ciclos for select using (public.es_usuario());
drop policy if exists ciclos_editar on public.ciclos;
create policy ciclos_editar on public.ciclos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists ofrecidos_usar on public.ofrecidos;
create policy ofrecidos_usar on public.ofrecidos for all using (public.es_usuario()) with check (public.es_usuario());

drop policy if exists consultas_ver on public.consultas_ia;
create policy consultas_ver on public.consultas_ia for select using (public.es_admin());
-- Las consultas las registra el servidor con la clave de servicio; los usuarios no escriben acá.
