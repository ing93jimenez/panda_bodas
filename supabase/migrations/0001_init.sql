-- Boda Fotos: esquema inicial
-- Todo el acceso pasa por el servidor (service role). El cliente anónimo
-- no tiene NINGUNA política: no puede leer, modificar ni borrar nada.

create table public.event (
  id int primary key default 1 check (id = 1),
  couple_names text not null default 'Novia & Novio',
  event_date date,
  status text not null default 'live' check (status in ('live','ended')),
  min_photos_for_winner int not null default 3 check (min_photos_for_winner >= 1),
  ended_at timestamptz,
  winner_guest_id uuid,
  top_photo_ids uuid[] not null default '{}',
  video_path text,
  updated_at timestamptz not null default now()
);
insert into public.event (id) values (1);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_token text unique,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index guests_name_unique on public.guests (lower(name));

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete restrict,
  storage_path text not null unique,
  width int,
  height int,
  status text not null default 'pending' check (status in ('pending','scoring','scored','failed')),
  score int check (score between 1 and 5),
  ai_reason text,
  ai_provider text,
  manual_override boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index photos_guest_idx on public.photos (guest_id);
create index photos_status_idx on public.photos (status);

alter table public.event add constraint event_winner_fk
  foreign key (winner_guest_id) references public.guests(id) on delete set null;

-- Las fotos nunca se borran: trigger que bloquea DELETE incluso para el servidor.
create or replace function public.prevent_photo_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Las fotos no se pueden borrar';
end $$;
create trigger photos_no_delete before delete on public.photos
  for each row execute function public.prevent_photo_delete();

alter table public.event enable row level security;
alter table public.guests enable row level security;
alter table public.photos enable row level security;

-- Bucket privado para fotos y video (límite 50 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);

-- 0002: desempate fino y cantidad del Top
alter table public.photos add column fine_score int check (fine_score between 0 and 100);
alter table public.event add column top_count int not null default 10 check (top_count between 1 and 50);
