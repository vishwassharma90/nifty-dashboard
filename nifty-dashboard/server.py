"""
Nifty 50 Dashboard - Python Server
Serves static files and proxies Yahoo Finance API requests.
No external dependencies required.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import http.server
import json
import os
import ssl
import urllib.request
import urllib.parse
from pathlib import Path

PORT = 3000
PUBLIC_DIR = Path(__file__).parent / "public"

# Yahoo Finance headers to mimic a browser
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

# Create an SSL context that doesn't verify certificates (for Yahoo Finance API)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def fetch_yahoo_data(symbol, range_val, interval):
    """Fetch chart data from Yahoo Finance API."""
    encoded_symbol = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded_symbol}"
        f"?range={range_val}&interval={interval}&includePrePost=false"
    )

    req = urllib.request.Request(url, headers=YAHOO_HEADERS)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=15) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        print(f"Error fetching Yahoo data: {e}")
        return json.dumps({"error": str(e)})


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler for the Nifty 50 Dashboard."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/chart":
            self.handle_chart_api(query)
        elif path == "/api/quote":
            self.handle_quote_api(query)
        else:
            # Serve static files from public directory
            super().do_GET()

    def handle_chart_api(self, query):
        """Proxy historical chart data from Yahoo Finance."""
        range_val = query.get("range", ["10y"])[0]
        interval = query.get("interval", ["1wk"])[0]
        symbol = query.get("symbol", ["^NSEI"])[0]

        data = fetch_yahoo_data(symbol, range_val, interval)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data.encode("utf-8"))

    def handle_quote_api(self, query):
        """Proxy live quote data from Yahoo Finance (1-day, 1-minute intervals)."""
        symbol = query.get("symbol", ["^NSEI"])[0]
        data = fetch_yahoo_data(symbol, "1d", "1m")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data.encode("utf-8"))

    def log_message(self, format, *args):
        """Custom log format."""
        if "/api/" in str(args[0]):
            print(f"  📡 API: {args[0]}")
        elif not any(ext in str(args[0]) for ext in [".css", ".js", ".ico", ".png", ".woff"]):
            print(f"  📄 {args[0]}")


def main():
    os.system("")  # Enable ANSI colors on Windows

    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║       🚀 Nifty 50 Live Dashboard         ║")
    print("  ╠══════════════════════════════════════════╣")
    print(f"  ║  Server:  http://localhost:{PORT}           ║")
    print("  ║  Press Ctrl+C to stop                    ║")
    print("  ╚══════════════════════════════════════════╝")
    print()

    with http.server.HTTPServer(("", PORT), DashboardHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n  🛑 Server stopped.")


if __name__ == "__main__":
    main()
