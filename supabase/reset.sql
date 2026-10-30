-- Event-day reset: wipes all players and re-opens the event. Run in SQL Editor at 8:30 on 3 Nov.
delete from players;
update event_state set finished = false, winner_rank = 1, winners = '{}' where id = 1;
