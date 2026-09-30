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
-- RLS: los alumnos (anon) solo leen e insertan; las
-- mutaciones "de autor" van por API con service_role.
-- =============================================
alter table preguntas.questions enable row level security;
alter table preguntas.games    enable row level security;
alter table preguntas.players  enable row level security;
alter table preguntas.answers  enable row level security;

-- Lectura pública (necesaria para jugar)
create policy "questions_select" on preguntas.questions for select to anon using (true);
create policy "games_select"     on preguntas.games    for select to anon using (true);
create policy "players_select"   on preguntas.players  for select to anon using (true);
create policy "answers_select"   on preguntas.answers  for select to anon using (true);

-- Los alumnos solo insertan jugadores y respuestas
create policy "players_insert"  on preguntas.players for insert to anon with check (true);
create policy "answers_insert"  on preguntas.answers for insert to anon with check (true);

-- =============================================
-- Realtime: cambios en vivo para lobby y juego
-- =============================================
alter publication supabase_realtime add table preguntas.questions;
alter publication supabase_realtime add table preguntas.games;
alter publication supabase_realtime add table preguntas.players;
alter publication supabase_realtime add table preguntas.answers;
