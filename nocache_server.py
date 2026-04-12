#!/usr/bin/env python3
import http.server, socketserver, os

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, format, *args):
        pass  # suppress logs

os.chdir('/home/baguspermana7/rz-work')
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', 8081), NoCacheHandler) as httpd:
    print('Serving on port 8081 (no-cache)')
    httpd.serve_forever()
