-- =============================================
-- EditorSQL Quiz - Schema "preguntas"
-- Todo el juego vive en este schema, separado de cualquier otra cosa.
-- Aplicado en el proyecto Supabase "bd_clases" (qsgwdehzbyhdjjsferpr).
-- =============================================

create schema if not exists preguntas;

-- ---------- Preguntas (banco del docente) ----------
create table if not exists preguntas.questions (
  id             uuid primary key default gen_random_uuid(),
  prompt         text not null check (char_length(prompt) between 1 and 500),
  options        jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  correct_index  smallint not null check (correct_index >= 0 and correct_index < 4),
  time_limit     smallint not null default 20 check (time_limit between 5 and 120),
  order_position integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- Partidas (código de 6 dígitos) ----------
create table if not exists preguntas.games (
  code                char(6) primary key,
  status              text not null default 'lobby' check (status in ('lobby', 'running', 'ended')),
  current_question    smallint not null default -1,
  question_started_at timestamptz,
  question_ends_at    timestamptz,
  created_at          timestamptz not null default now(),
  ended_at            timestamptz
);

-- ---------- Jugadores ----------
create table if not exists preguntas.players (
  id         uuid primary key default gen_random_uuid(),
  game_code  char(6) not null references preguntas.games(code) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  score      integer not null default 0,
  streak     smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (game_code, nickname)
);
create index if not exists idx_players_game on preguntas.players(game_code);

-- ---------- Respuestas ----------
create table if not exists preguntas.answers (
  id             uuid primary key default gen_random_uuid(),
  game_code      char(6) not null references preguntas.games(code) on delete cascade,
  player_id      uuid not null references preguntas.players(id) on delete cascade,
  question_index smallint not null,
  option_index   smallint not null,
  is_correct     boolean not null,
  time_ms        integer not null,
  points         integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (game_code, player_id, question_index)
);
create index if not exists idx_answers_game on preguntas.answers(game_code);
create index if not exists idx_answers_player on preguntas.answers(player_id);

-- =============================================
-- Acceso: RLS DESACTIVADO en estas tablas — Realtime no entrega
-- eventos UPDATE/DELETE sobre tablas con RLS, y el juego depende
-- de esos eventos en vivo. El control de acceso queda en los
-- grants de tabla (anon: solo SELECT + INSERT en players/answers;
-- service_role: total). Sin datos sensibles expuestos: las
-- correctas están en questions por decisión de diseño.
-- Requiere además exponer "preguntas" en Settings → API → Exposed schemas.
-- =============================================
alter table preguntas.questions disable row level security;
alter table preguntas.games    disable row level security;
alter table preguntas.players  disable row level security;
alter table preguntas.answers  disable row level security;

-- anon (alumnos) y roles de la API pueden "entrar" al schema
grant usage on schema preguntas to anon, authenticated, service_role;

-- service_role (API routes del docente): acceso total
grant all on all tables in schema preguntas to service_role;

-- anon (alumnos): select + insert de jugadores/respuestas (sin update/delete)
grant select on all tables in schema preguntas to anon, authenticated;
grant insert on preguntas.players, preguntas.answers to anon, authenticated;

-- Futuras tablas del schema heredan los grants
alter default privileges in schema preguntas grant all on tables to service_role;
alter default privileges in schema preguntas grant select on tables to anon, authenticated;
alter default privileges in schema preguntas grant insert on tables to anon, authenticated;

-- =============================================
-- Realtime: cambios en vivo para lobby y juego.
-- replica identity full para que los UPDATE lleven el registro viejo/nuevo.
-- =============================================
alter table preguntas.questions replica identity full;
alter table preguntas.games    replica identity full;
alter table preguntas.players  replica identity full;
alter table preguntas.answers  replica identity full;
alter publication supabase_realtime add table preguntas.questions;
alter publication supabase_realtime add table preguntas.games;
alter publication supabase_realtime add table preguntas.players;
alter publication supabase_realtime add table preguntas.answers;
