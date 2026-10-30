-- 002: close loopholes a player could use by calling the database directly
-- (the publishable key is public, so anyone can bypass the web page).
-- Run once in Supabase → SQL Editor, after 001_init.sql.

-- 1. Players may only write these columns: a new entry is just a nickname,
--    and later only the 3 game numbers and the confirmation can change.
--    (Before: a player could insert a pre-confirmed entry with any score, or rename themselves.)
revoke insert, update on players from anon;
grant insert (nickname) on players to anon;
grant update (g1, g2, g3, confirmed_at) on players to anon;

-- 2. The database decides the confirmation time used for tie-breaks.
--    (Before: a player could send a confirmation time from the past and win a tie.)
create or replace function stamp_confirmation() returns trigger
language plpgsql as $$
begin
  if new.confirmed_at is not null and old.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  return new;
end $$;

create trigger players_stamp_confirmation
  before update on players
  for each row execute function stamp_confirmation();

-- 3. Nobody can join after Finish.
drop policy "join" on players;
create policy "join" on players for insert
  with check (not (select finished from event_state where id = 1));
