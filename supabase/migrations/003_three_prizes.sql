-- 003: three prizes (1st, 2nd, 3rd) instead of one.
-- Run once in Supabase → SQL Editor, after 002_harden_player_writes.sql.

-- Who received each prize, in order: winners[1] got 1st prize, winners[2] got 2nd, ...
-- The prize being handed out now is the next one (array length + 1); all done at 3.
-- A skipped player is never added, so the next player in line moves up a prize.
alter table event_state add column winners uuid[] not null default '{}';

-- Replaced by `winners`: the handout is over once 3 players are in it.
alter table event_state drop column prize_given;
