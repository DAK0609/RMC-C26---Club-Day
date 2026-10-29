-- Run this once in Supabase → SQL Editor.

create table players (
  id           uuid primary key default gen_random_uuid(),
  nickname     text not null check (char_length(nickname) between 1 and 20),
  g1           int  check (g1 between 0 and 3),
  g2           int  check (g2 >= 0),
  g3           int  check (g3 between 0 and 9),
  -- Total is computed by the database so every page agrees on it.
  total        int generated always as (
                 case g1 when 0 then 5 when 1 then 10 when 2 then 20 when 3 then 30 else 0 end
               + case when g2 is null then 0 when g2 < 7 then 5 else 20 + 10 * (g2 - 7) end
               + case when g3 is null then 0 when g3 < 3 then 5 else 20 + 10 * (g3 - 3) end
               ) stored,
  confirmed_at timestamptz,          -- set when player taps "Yes"; locks the row
  created_at   timestamptz not null default now(),
  -- g1..g3 are saved one by one as drafts; confirming needs all three.
  check (confirmed_at is null or (g1 is not null and g2 is not null and g3 is not null))
);

-- Single-row table holding the event state.
create table event_state (
  id          int primary key default 1 check (id = 1),
  finished    boolean not null default false,
  winner_rank int     not null default 1,     -- rank currently invited to claim the prize
  prize_given boolean not null default false
);
insert into event_state default values;

-- Nicknames are unique, ignoring upper/lower case and extra spaces.
create unique index players_nickname_unique on players (lower(trim(nickname)));

-- Ranking: higher total first, earlier confirmation wins ties.
create view leaderboard as
  select id, nickname, g1, g2, g3, total, confirmed_at,
         row_number() over (order by total desc, confirmed_at asc) as rank
  from players
  where confirmed_at is not null;

-- Realtime
alter publication supabase_realtime add table players, event_state;

-- Row Level Security
alter table players     enable row level security;
alter table event_state enable row level security;

create policy "read players"  on players for select using (true);
create policy "join"          on players for insert with check (confirmed_at is null);
-- Results can be saved only once, and only before the host taps Finish.
-- "using" checks the row before the change; "with check (true)" lets the row become confirmed.
create policy "submit once"   on players for update
  using (confirmed_at is null and not (select finished from event_state where id = 1))
  with check (true);

-- TODO: restrict this to the organiser once admin protection is decided.
create policy "admin remove"  on players for delete using (true);

create policy "read state"    on event_state for select using (true);
-- TODO: restrict this to the organiser once admin protection is decided.
create policy "admin update"  on event_state for update using (true);

-- Let the web pages (anon key) reach the tables; row security above still applies.
grant select, insert, update, delete on players     to anon;
grant select, update                 on event_state to anon;
grant select                         on leaderboard to anon;
