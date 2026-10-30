import { db } from './api.js';

// Keeps a page in sync with the database. `refresh` reloads everything the page shows.
// It runs on start, on every realtime change to `tables`, whenever the realtime
// connection (re)connects (events may have been missed), when the phone wakes up or
// comes back online, and every `pollMs` as a safety net.
// Runs never overlap: a burst of events during a run causes exactly one more run.
// `onConnection(ok)` is told whether the page is currently up to date.
// Returns `run`, so a page can refresh right after its own actions. `await run()`
// always waits for a refresh that started after the call, so the page never
// re-enables buttons on data from before the action.
export function keepFresh(refresh, { tables, pollMs = 30_000, onConnection = () => {} }) {
  let current = null; // the refresh in progress
  let queued = null;  // the one extra refresh waiting for it
  let live = null; // null = still connecting, which isn't reported as a problem
  let fetchOk = true;
  const report = () => onConnection(live !== false && fetchOk);

  function run() {
    if (queued) return queued;
    if (current) {
      queued = current.then(() => {
        queued = null;
        return run();
      });
      return queued;
    }
    current = (async () => {
      try {
        await refresh();
        fetchOk = true;
      } catch (err) {
        console.error(err);
        fetchOk = false;
      }
      current = null;
      report();
    })();
    return current;
  }

  const channel = db.channel(`sync:${tables.join(',')}`);
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, run);
  }
  channel.subscribe((status) => {
    live = status === 'SUBSCRIBED';
    report();
    if (live) run();
  });

  setInterval(run, pollMs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  window.addEventListener('online', run);
  run();
  return run;
}
