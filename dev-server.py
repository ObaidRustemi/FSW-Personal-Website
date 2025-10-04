#!/usr/bin/env python3
"""
Simple HTTP server with no-cache headers for development.
This prevents browser caching issues when updating images/CSS/JS.
"""
import http.server
import socketserver
from datetime import datetime

PORT = 8080

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add no-cache headers to prevent browser caching during development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Add timestamp to log messages
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format % args))

if __name__ == '__main__':
    import sys
    
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"🚀 Dev server running at http://localhost:{PORT}")
        print(f"📁 Serving from: {httpd.server_address}")
        print(f"⚡ No-cache headers enabled - images/CSS will always reload fresh")
        print(f"Press Ctrl+C to stop\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✅ Server stopped")
            sys.exit(0)

