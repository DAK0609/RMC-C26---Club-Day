"""Minimal Chrome DevTools Protocol driver: runs headless Edge (or Chrome) and controls tabs.
Used by browser_test.py. Needs: python -m pip install websockets
"""
import asyncio, base64, json, os, subprocess, tempfile, shutil, urllib.request, itertools, pathlib, time

import websockets

# Set BROWSER to use another Chromium browser, e.g. Chrome.
EDGE = os.environ.get('BROWSER', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
PORT = 9333


class Browser:
    def __enter__(self):
        self.profile = tempfile.mkdtemp()
        self.proc = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', f'--remote-debugging-port={PORT}',
                                      f'--user-data-dir={self.profile}', '--no-first-run', 'about:blank'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version')
                break
            except OSError:
                time.sleep(0.2)
        return self

    def __exit__(self, *a):
        self.proc.kill()
        self.proc.wait()
        shutil.rmtree(self.profile, ignore_errors=True)


class Tab:
    """One page. Collects console messages and JS errors in self.logs."""
    _ids = itertools.count(1)

    @classmethod
    async def open(cls, width=390, height=780, mobile=True):
        req = urllib.request.Request(f'http://127.0.0.1:{PORT}/json/new?about:blank', method='PUT')
        info = json.load(urllib.request.urlopen(req))
        tab = cls()
        tab.ws = await websockets.connect(info['webSocketDebuggerUrl'], max_size=50_000_000)
        tab.pending, tab.logs = {}, []
        tab.reader = asyncio.create_task(tab._read())
        await tab.send('Runtime.enable')
        await tab.send('Page.enable')
        await tab.send('Emulation.setDeviceMetricsOverride',
                       width=width, height=height, deviceScaleFactor=1, mobile=mobile)
        return tab

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if 'id' in msg and msg['id'] in self.pending:
                self.pending.pop(msg['id']).set_result(msg)
            elif msg.get('method') == 'Runtime.consoleAPICalled':
                p = msg['params']
                self.logs.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args']))
            elif msg.get('method') == 'Runtime.exceptionThrown':
                d = msg['params']['exceptionDetails']
                self.logs.append('EXCEPTION: ' + d.get('exception', {}).get('description', d.get('text', '')))

    async def send(self, method, **params):
        i = next(self._ids)
        fut = asyncio.get_running_loop().create_future()
        self.pending[i] = fut
        await self.ws.send(json.dumps({'id': i, 'method': method, 'params': params}))
        msg = await asyncio.wait_for(fut, 30)
        if 'error' in msg:
            raise RuntimeError(msg['error'])
        return msg.get('result', {})

    async def go(self, url, settle=4):
        await self.send('Page.navigate', url=url)
        await asyncio.sleep(settle)

    async def js(self, expr):
        r = await self.send('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        if 'exceptionDetails' in r:
            raise RuntimeError(r['exceptionDetails'])
        return r['result'].get('value')

    async def wait_for(self, expr, timeout=10):
        """Polls a JS expression until it's truthy. Returns seconds waited, or None on timeout."""
        start = time.time()
        while time.time() - start < timeout:
            if await self.js(expr):
                return max(round(time.time() - start, 1), 0.1)  # never 0.0, which is falsy
            await asyncio.sleep(0.25)
        return None

    async def shot(self, path):
        data = (await self.send('Page.captureScreenshot', format='png'))['data']
        pathlib.Path(path).write_bytes(base64.b64decode(data))

    async def close(self):
        self.reader.cancel()
        await self.ws.close()
