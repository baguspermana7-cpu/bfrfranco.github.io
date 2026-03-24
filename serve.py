#!/usr/bin/env python3
"""
ResistanceZero Development Server
Fixes MIME type issues with Python's built-in http.server.
Usage: python3 serve.py [port]  (default: 8081)
"""
import http.server
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8081

# Fix missing MIME types that break CSS/JS loading in browsers
EXTRA_MIME = {
    '.css':   'text/css',
    '.js':    'application/javascript',
    '.mjs':   'application/javascript',
    '.json':  'application/json',
    '.webp':  'image/webp',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
    '.svg':   'image/svg+xml',
    '.webm':  'video/webm',
    '.mp4':   'video/mp4',
    '.ico':   'image/x-icon',
    '.avif':  'image/avif',
}

class RZHandler(http.server.SimpleHTTPRequestHandler):
    # Add proper MIME types
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        **EXTRA_MIME,
    }

    def end_headers(self):
        # Add cache-control headers to prevent stale CSS/JS
        if self.path.endswith(('.css', '.js')):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        elif self.path.endswith('.html') or self.path == '/' or '?' not in self.path and '.' not in self.path.split('/')[-1]:
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        else:
            # Images, fonts: cache for 1 hour
            self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()

    def log_message(self, format, *args):
        # Cleaner log output
        msg = format % args
        if '200' in msg or '304' in msg:
            return  # suppress successful requests for cleaner output
        sys.stderr.write(f"[rz-server] {msg}\n")

os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
print(f"ResistanceZero Dev Server")
print(f"Serving at http://localhost:{PORT}")
print(f"MIME fixes: {', '.join(EXTRA_MIME.keys())}")
print(f"Cache: CSS/JS/HTML = no-cache | Images/Fonts = 1 hour")
print(f"Press Ctrl+C to stop\n")

with http.server.HTTPServer(('', PORT), RZHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
