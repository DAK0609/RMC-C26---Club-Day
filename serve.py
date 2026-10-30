"""Local test server: like `python -m http.server 8000`, but tells browsers not to cache,
so a phone or iPad always gets the latest files after a change. Run: python serve.py"""
import http.server

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer(('', 8000), NoCache).serve_forever()
