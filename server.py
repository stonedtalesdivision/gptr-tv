import sys
import socket
import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import hmac
import hashlib
import http.cookies
import json
import os
import mimetypes
import re
import ssl

PORT = int(os.environ.get('PORT', 5145))
SITE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'site'))

# SSL context for duckdns if needed
# Use the platform trust store and verify both the certificate chain and hostname.
ssl_ctx = ssl.create_default_context()

import threading
import subprocess
import tempfile
import shutil
import time

AUTH_COOKIE_NAME = 'gptrtv_session'
AUTH_SIGNING_KEY = os.urandom(32)
AUTH_SESSION_MAX_AGE = 43200

HLS_SESSIONS = {}
HLS_LOCK = threading.Lock()

def read_hls_file(filepath, attempts=8, delay=0.1):
    """Retry briefly when FFmpeg is replacing or publishing an HLS file."""
    last_error = None
    for attempt in range(attempts):
        try:
            with open(filepath, 'rb') as stream:
                content = stream.read()
            if content:
                return content
            last_error = OSError("Generated HLS file is empty")
        except OSError as exc:
            last_error = exc
        if attempt + 1 < attempts:
            time.sleep(delay)
    raise last_error or OSError("Unable to read generated HLS file")


def cleanup_hls_sessions():
    while True:
        time.sleep(10)
        with HLS_LOCK:
            now = time.time()
            to_del = []
            for s_id, sess in HLS_SESSIONS.items():
                if now - sess['last_access'] > 60:
                    to_del.append(s_id)
            for s_id in to_del:
                sess = HLS_SESSIONS.pop(s_id, None)
                if sess:
                    try:
                        sess['proc'].terminate()
                        sess['proc'].wait(timeout=2)
                    except Exception:
                        try:
                            sess['proc'].kill()
                        except Exception:
                            pass
                    try:
                        shutil.rmtree(sess['dir'], ignore_errors=True)
                    except Exception:
                        pass
                    print(f"[HLS] Cleaned up session for stream {s_id}")

threading.Thread(target=cleanup_hls_sessions, daemon=True).start()

# In-memory cache for credentials and channels
CACHE = {
    'codes': {
        'RAGHU4571': {
            "success": True,
            "name": "gandreti raghu",
            "playlistType": "xtream",
            "channelSettings": None,
        }
    },
    'live_categories': None,
    'live_streams': None,
    'vod_categories': None,
    'vod_streams_by_cat': {},
    'series_categories': None,
    'series_by_cat': {},
    'sports_channels': {}
}

USER_AGENT = 'IPTVSmartersPro'

def fetch_json(url, timeout=12):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8', errors='ignore'))

def get_configured_xtream_creds():
    """Read upstream Xtream credentials from the deployment environment."""
    server = os.environ.get('GPTR_XTREAM_SERVER', '').strip().rstrip('/')
    username = os.environ.get('GPTR_XTREAM_USERNAME', '').strip()
    password = os.environ.get('GPTR_XTREAM_PASSWORD', '').strip()
    if not all((server, username, password)):
        raise RuntimeError("Xtream upstream configuration is incomplete; set GPTR_XTREAM_SERVER, GPTR_XTREAM_USERNAME and GPTR_XTREAM_PASSWORD.")
    return server, username, password


def xtream_api_url(server, username, password, **params):
    query = {'username': username, 'password': password}
    query.update(params)
    return f"{server}/player_api.php?{urllib.parse.urlencode(query)}"


def precache_catalog():
    # 1. Load local categories immediately from disk
    local_cats = os.path.join(SITE_DIR, 'unlocked_categories.json')
    if os.path.exists(local_cats):
        try:
            with open(local_cats, 'r', encoding='utf-8') as f:
                CACHE['live_categories'] = json.load(f)
            print(f"[PRE-CACHE] Instantly loaded {len(CACHE['live_categories'])} live categories from disk.")
        except Exception as e:
            print(f"[PRE-CACHE] Notice loading categories from disk: {e}")

    # 2. Load local streams immediately from disk
    local_streams = os.path.join(SITE_DIR, 'unlocked_channels.json')
    if os.path.exists(local_streams):
        try:
            with open(local_streams, 'r', encoding='utf-8') as f:
                CACHE['live_streams'] = json.load(f)
            print(f"[PRE-CACHE] Instantly loaded {len(CACHE['live_streams'])} live channels from disk.")
        except Exception as e:
            print(f"[PRE-CACHE] Notice loading channels from disk: {e}")

    # 3. Load local VOD & Series categories from disk
    local_vod_cats = os.path.join(SITE_DIR, 'unlocked_vod_categories.json')
    if os.path.exists(local_vod_cats):
        try:
            with open(local_vod_cats, 'r', encoding='utf-8') as f:
                CACHE['vod_categories'] = json.load(f)
            print(f"[PRE-CACHE] Instantly loaded {len(CACHE['vod_categories'])} VOD categories from disk.")
        except Exception as e:
            pass

    local_series_cats = os.path.join(SITE_DIR, 'unlocked_series_categories.json')
    if os.path.exists(local_series_cats):
        try:
            with open(local_series_cats, 'r', encoding='utf-8') as f:
                CACHE['series_categories'] = json.load(f)
            print(f"[PRE-CACHE] Instantly loaded {len(CACHE['series_categories'])} Series categories from disk.")
        except Exception as e:
            pass

    # 3. Only fetch from network if disk cache was missing
    if not CACHE['live_categories']:
        try:
            server, user, pwd = get_configured_xtream_creds()
            url_cat = xtream_api_url(server, user, pwd, action='get_live_categories')
            CACHE['live_categories'] = fetch_json(url_cat, timeout=12)
            print(f"[PRE-CACHE] Network cached {len(CACHE['live_categories'])} live categories.")
        except Exception as e:
            print(f"[PRE-CACHE] Upstream categories notice: {e}")

    if not CACHE['live_streams']:
        try:
            server, user, pwd = get_configured_xtream_creds()
            url_streams = xtream_api_url(server, user, pwd, action='get_live_streams')
            CACHE['live_streams'] = fetch_json(url_streams, timeout=30)
            print(f"[PRE-CACHE] Network cached {len(CACHE['live_streams'])} channels successfully!")
        except Exception as e:
            print(f"[PRE-CACHE] Upstream streams notice: {e}")

# Run immediate load on startup
precache_catalog()


class GPTRTVHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def end_headers(self):
        try:
            # Add CORS and Cache-Control headers
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')
            self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def _auth_token(self, code):
        signature = hmac.new(AUTH_SIGNING_KEY, code.encode('utf-8'), hashlib.sha256).hexdigest()
        return f"{code}.{signature}"

    def _set_auth_cookie(self, code):
        self.send_header(
            'Set-Cookie',
            f"{AUTH_COOKIE_NAME}={self._auth_token(code)}; Path=/; Max-Age={AUTH_SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax"
        )

    def _is_authenticated(self):
        cookies = http.cookies.SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            morsel = cookies.get(AUTH_COOKIE_NAME)
            if morsel is None:
                return False
            code, separator, supplied_signature = morsel.value.partition('.')
            if not separator or code not in CACHE['codes']:
                return False
            expected_signature = hmac.new(
                AUTH_SIGNING_KEY, code.encode('utf-8'), hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(supplied_signature, expected_signature)
        except (ValueError, TypeError):
            return False

    def _require_authentication(self):
        if self._is_authenticated():
            return True
        self.send_response(401)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Authentication required. Please validate your access code again.'}).encode('utf-8'))
        return False

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/iptv/validate-code') or self.path == '/api/validate-code':
            self.handle_validate_code()
        else:
            self.send_error(404, "Not Found")

    def handle_validate_code(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            if content_len <= 0 or content_len > 8192:
                self.send_response(413 if content_len > 8192 else 400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Request body must be between 1 and 8192 bytes.'}).encode('utf-8'))
                self.close_connection = True
                return

            body = self.rfile.read(content_len)
            if len(body) != content_len:
                raise ValueError("Incomplete request body")
            data = json.loads(body.decode('utf-8'))
            if not isinstance(data, dict) or not isinstance(data.get('code'), str):
                raise ValueError("Access code must be a string")
            code = data['code'].strip().upper()
            if not code or len(code) > 256:
                raise ValueError("Access code length is invalid")
        except Exception:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Invalid request format'}).encode('utf-8'))
            return

        print("[AUTH] Validating access code")

        # Check local cache first
        if code in CACHE['codes']:
            res = CACHE['codes'][code]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._set_auth_cookie(code)
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
            return

        # Forward validation to duckdns server
        url = 'https://gptrtvapi.duckdns.org/api/iptv/validate-code'
        try:
            req_data = json.dumps({'code': code}).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={
                    'User-Agent': 'GPTR TV',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            )
            with urllib.request.urlopen(req, timeout=4, context=ssl_ctx) as resp:
                resp_data = resp.read()
                parsed = json.loads(resp_data.decode('utf-8', errors='ignore'))
                if parsed.get('success'):
                    CACHE['codes'][code] = parsed
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                if parsed.get('success'):
                    self._set_auth_cookie(code)
                self.end_headers()
                self.wfile.write(resp_data)
                print("[AUTH SUCCESS] Access code validated")
                return
        except urllib.error.HTTPError as e:
            err_body = e.read()
            print(f"[AUTH FAILED] Validation service returned HTTP {e.code}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(err_body)
            return
        except (TimeoutError, socket.timeout):
            print("[AUTH ERROR] Validation service timed out")
            self.send_response(504)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Validation service timed out. Please try again.'}).encode('utf-8'))
        except (urllib.error.URLError, OSError) as e:
            print(f"[AUTH ERROR] Validation service unavailable: {type(e).__name__}")
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Validation service is temporarily unavailable. Please try again.'}).encode('utf-8'))
        except Exception as e:
            print(f"[AUTH ERROR] Unexpected validation failure: {type(e).__name__}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'An unexpected validation error occurred.'}).encode('utf-8'))

    def do_GET(self):
        # Protect catalog APIs and media proxy routes with the validated session cookie.
        if self.path.startswith('/api/') or self.path.startswith('/stream/'):
            if not self._require_authentication():
                return
        # Route API requests
        if self.path.startswith('/api/'):
            self.handle_api()
        elif self.path.startswith('/stream/'):
            self.handle_stream()
        else:
            super().do_GET()

    def handle_api(self):
        # Extract query parameters
        path_parts = self.path.split('?')
        base_path = path_parts[0]
        query = path_parts[1] if len(path_parts) > 1 else ''
        params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)

        # 1. Live categories
        if base_path == '/api/catalog/live-categories':
            self.handle_live_categories()
        # 2. Live streams (all or by category)
        elif base_path == '/api/catalog/live-streams':
            cat_id = params.get('category_id')
            self.handle_live_streams(cat_id)
        # 3. VOD categories
        elif base_path == '/api/catalog/vod-categories':
            self.handle_vod_categories()
        # 4. VOD streams
        elif base_path == '/api/catalog/vod-streams':
            cat_id = params.get('category_id')
            self.handle_vod_streams(cat_id)
        # 5. Series categories
        elif base_path == '/api/catalog/series-categories':
            self.handle_series_categories()
        # 6. Series streams
        elif base_path == '/api/catalog/series':
            cat_id = params.get('category_id')
            self.handle_series(cat_id)
        # 6b. Series info / episodes
        elif base_path == '/api/catalog/series-info':
            series_id = params.get('series_id')
            self.handle_series_info(series_id)
        # 7. Sports channels
        elif base_path == '/api/iptv/sports/channels':
            code = params.get('code', 'RAGHU4571')
            self.handle_sports_channels(code)
        # 8. User / account info
        elif base_path == '/api/account/info':
            self.handle_account_info()
        else:
            self.send_error(404, "API route not found")

    def get_xtream_creds(self):
        return get_configured_xtream_creds()

    def handle_account_info(self):
        server, user, pwd = self.get_xtream_creds()
        url = xtream_api_url(server, user, pwd)
        try:
            data = fetch_json(url, timeout=6)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))

    def handle_live_categories(self):
        if CACHE['live_categories'] is None:
            local_cats = os.path.join(SITE_DIR, 'unlocked_categories.json')
            if os.path.exists(local_cats):
                try:
                    with open(local_cats, 'r', encoding='utf-8') as f:
                        CACHE['live_categories'] = json.load(f)
                except Exception:
                    pass

        if CACHE['live_categories'] is not None:
            data = CACHE['live_categories']
        else:
            server, user, pwd = self.get_xtream_creds()
            url = xtream_api_url(server, user, pwd, action='get_live_categories')
            try:
                data = fetch_json(url, timeout=10)
                CACHE['live_categories'] = data
            except Exception as e:
                local_cats = os.path.join(SITE_DIR, 'unlocked_categories.json')
                if os.path.exists(local_cats):
                    with open(local_cats, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    CACHE['live_categories'] = data
                else:
                    self.send_error(500, f"Error fetching live categories: {e}")
                    return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_live_streams(self, cat_id=None):
        if CACHE['live_streams'] is None:
            local_streams = os.path.join(SITE_DIR, 'unlocked_channels.json')
            if os.path.exists(local_streams):
                try:
                    with open(local_streams, 'r', encoding='utf-8') as f:
                        CACHE['live_streams'] = json.load(f)
                except Exception:
                    pass

        if CACHE['live_streams'] is not None:
            data = CACHE['live_streams']
        else:
            server, user, pwd = self.get_xtream_creds()
            url = xtream_api_url(server, user, pwd, action='get_live_streams')
            try:
                print("[CATALOG] Fetching full 14,740 live streams from Livebox...")
                data = fetch_json(url, timeout=25)
                CACHE['live_streams'] = data
                print(f"[CATALOG] Cached {len(data)} live channels successfully!")
            except Exception as e:
                local_streams = os.path.join(SITE_DIR, 'unlocked_channels.json')
                if os.path.exists(local_streams):
                    with open(local_streams, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    CACHE['live_streams'] = data
                else:
                    self.send_error(500, f"Error fetching live streams: {e}")
                    return

        if cat_id:
            filtered = [s for s in data if str(s.get('category_id')) == str(cat_id)]
        else:
            filtered = data

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(filtered).encode('utf-8'))

    def handle_vod_categories(self):
        if CACHE['vod_categories'] is None:
            p = os.path.join(SITE_DIR, 'unlocked_vod_categories.json')
            if os.path.exists(p):
                try:
                    with open(p, 'r', encoding='utf-8') as f:
                        CACHE['vod_categories'] = json.load(f)
                except Exception:
                    pass
        if CACHE['vod_categories'] is not None:
            data = CACHE['vod_categories']
        else:
            server, user, pwd = self.get_xtream_creds()
            url = xtream_api_url(server, user, pwd, action='get_vod_categories')
            try:
                data = fetch_json(url, timeout=10)
                CACHE['vod_categories'] = data
            except Exception as e:
                self.send_error(500, f"Error fetching VOD categories: {e}")
                return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_vod_streams(self, cat_id=None):
        server, user, pwd = self.get_xtream_creds()
        if not cat_id:
            # If no cat_id provided, default to first category or top movies
            cat_id = '122' # ENGLISH | 4K

        if cat_id in CACHE['vod_streams_by_cat']:
            data = CACHE['vod_streams_by_cat'][cat_id]
        else:
            url = xtream_api_url(server, user, pwd, action='get_vod_streams', category_id=cat_id)
            try:
                data = fetch_json(url, timeout=12)
                CACHE['vod_streams_by_cat'][cat_id] = data
            except Exception as e:
                self.send_error(500, f"Error fetching VOD streams: {e}")
                return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_series_categories(self):
        if CACHE['series_categories'] is None:
            p = os.path.join(SITE_DIR, 'unlocked_series_categories.json')
            if os.path.exists(p):
                try:
                    with open(p, 'r', encoding='utf-8') as f:
                        CACHE['series_categories'] = json.load(f)
                except Exception:
                    pass
        if CACHE['series_categories'] is not None:
            data = CACHE['series_categories']
        else:
            server, user, pwd = self.get_xtream_creds()
            url = xtream_api_url(server, user, pwd, action='get_series_categories')
            try:
                data = fetch_json(url, timeout=10)
                CACHE['series_categories'] = data
            except Exception as e:
                self.send_error(500, f"Error fetching Series categories: {e}")
                return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_series(self, cat_id=None):
        server, user, pwd = self.get_xtream_creds()
        if not cat_id:
            cat_id = '518' # Highlights / top series

        if cat_id in CACHE['series_by_cat']:
            data = CACHE['series_by_cat'][cat_id]
        else:
            url = xtream_api_url(server, user, pwd, action='get_series', category_id=cat_id)
            try:
                data = fetch_json(url, timeout=12)
                CACHE['series_by_cat'][cat_id] = data
            except Exception as e:
                self.send_error(500, f"Error fetching Series: {e}")
                return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_series_info(self, series_id):
        if not series_id:
            self.send_error(400, "Missing series_id")
            return
        server, user, pwd = self.get_xtream_creds()
        url = xtream_api_url(server, user, pwd, action='get_series_info', series_id=series_id)
        try:
            data = fetch_json(url, timeout=12)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error fetching Series Info: {e}")

    def handle_sports_channels(self, code):
        url = f'https://gptrtvapi.duckdns.org/api/iptv/sports/channels?code={code}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'GPTR TV'})
            with urllib.request.urlopen(req, timeout=6, context=ssl_ctx) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
                return
        except Exception as e:
            # Fallback sports categories
            fallback = {
                "ok": True,
                "enabled": True,
                "categories": ["Cricket", "Football", "SonyLiv", "Fancode", "Star Sports", "Willow"]
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(fallback).encode('utf-8'))

    def handle_stream(self):
        m_hls = re.match(r'^/stream/hls/(\d+)/([a-zA-Z0-9_.-]+\.(m3u8|ts))', self.path)
        m_m3u8 = re.match(r'^/stream/live/(\d+)\.m3u8', self.path)
        m_ts = re.match(r'^/stream/live/(\d+)\.ts', self.path)
        m_movie = re.match(r'^/stream/movie/(\d+)\.([a-zA-Z0-9]+)', self.path)
        m_series = re.match(r'^/stream/series/(\d+)\.([a-zA-Z0-9]+)', self.path)

        if m_hls:
            stream_id = m_hls.group(1)
            filename = m_hls.group(2)
            self.handle_hls_stream(stream_id, filename)
            return

        if m_m3u8:
            stream_id = m_m3u8.group(1)
            # Redirect to real HLS transmuxer
            self.send_response(302)
            self.send_header('Location', f'/stream/hls/{stream_id}/index.m3u8')
            self.end_headers()
            return

        if m_ts:
            stream_id = m_ts.group(1)
            server, user, pwd = self.get_xtream_creds()
            ts_url = f'{server}/live/{user}/{pwd}/{stream_id}.ts'
            self.proxy_live_stream(ts_url)
            return

        if m_movie:
            stream_id = m_movie.group(1)
            ext = m_movie.group(2)
            server, user, pwd = self.get_xtream_creds()
            movie_url = f'{server}/movie/{user}/{pwd}/{stream_id}.{ext}'
            content_type = 'video/mp4' if ext == 'mp4' else 'video/x-matroska'
            self.proxy_vod_file(movie_url, content_type)
            return

        if m_series:
            stream_id = m_series.group(1)
            ext = m_series.group(2)
            server, user, pwd = self.get_xtream_creds()
            series_url = f'{server}/series/{user}/{pwd}/{stream_id}.{ext}'
            content_type = 'video/mp4' if ext == 'mp4' else 'video/x-matroska'
            self.proxy_vod_file(series_url, content_type)
            return

        self.send_error(404, "Stream not found")

    def handle_hls_stream(self, stream_id, filename):
        ffmpeg_path = shutil.which('ffmpeg')
        if not ffmpeg_path:
            print("[HLS ERROR] FFmpeg executable is not installed or not on PATH")
            self.send_error(503, "HLS playback is unavailable: FFmpeg is not installed on the server")
            return

        server, user, pwd = self.get_xtream_creds()
        with HLS_LOCK:
            sess = HLS_SESSIONS.get(stream_id)
            if not sess or sess['proc'].poll() is not None:
                temp_dir = os.path.join(tempfile.gettempdir(), f"gptr_hls_{stream_id}")
                os.makedirs(temp_dir, exist_ok=True)
                for name in os.listdir(temp_dir):
                    path = os.path.join(temp_dir, name)
                    try:
                        if os.path.isfile(path) or os.path.islink(path):
                            os.remove(path)
                        elif os.path.isdir(path):
                            shutil.rmtree(path, ignore_errors=True)
                    except OSError:
                        pass

                upstream_url = f'{server}/live/{user}/{pwd}/{stream_id}.ts'
                playlist_path = os.path.join(temp_dir, 'index.m3u8')
                cmd = [
                    ffmpeg_path, '-y', '-hide_banner', '-loglevel', 'error',
                    '-user_agent', USER_AGENT,
                    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
                    '-i', upstream_url,
                    '-c:v', 'copy',
                    '-c:a', 'copy',
                    '-f', 'hls',
                    '-hls_time', '2',
                    '-hls_list_size', '8',
                    '-hls_delete_threshold', '10',
                    '-hls_flags', 'delete_segments+split_by_time',
                    playlist_path
                ]
                try:
                    proc = subprocess.Popen(
                        cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                    )
                except OSError as exc:
                    print(f"[HLS ERROR] Could not start FFmpeg: {type(exc).__name__}")
                    self.send_error(503, "HLS playback could not start. Check the FFmpeg installation.")
                    return

                sess = {'proc': proc, 'dir': temp_dir, 'last_access': time.time()}
                HLS_SESSIONS[stream_id] = sess
                print(f"[HLS] Started FFmpeg session for stream {stream_id}")
            else:
                sess['last_access'] = time.time()

        filepath = os.path.join(sess['dir'], filename)
        if filename == 'index.m3u8':
            for _ in range(140):
                if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                    break
                if sess['proc'].poll() is not None:
                    print(f"[HLS ERROR] FFmpeg exited with code {sess['proc'].returncode}")
                    with HLS_LOCK:
                        HLS_SESSIONS.pop(stream_id, None)
                    self.send_error(502, "FFmpeg stopped before producing an HLS playlist. Check the upstream stream and server logs.")
                    return
                time.sleep(0.25)

            if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
                self.send_error(504, "Timed out waiting for FFmpeg to generate the HLS playlist")
                return
            try:
                content = read_hls_file(filepath, attempts=5, delay=0.1)
                self.send_response(200)
                self.send_header('Content-Type', 'application/vnd.apple.mpegurl')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
                return
            except OSError:
                self.send_error(503, "HLS playlist is temporarily being updated; retry shortly")
                return
        else:
            if not os.path.exists(filepath):
                for _ in range(8):
                    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                        break
                    if sess['proc'].poll() is not None:
                        self.send_error(502, "FFmpeg stopped while generating an HLS segment")
                        return
                    time.sleep(0.25)
            if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
                self.send_error(404, "HLS segment is not available yet")
                return
            try:
                content = read_hls_file(filepath, attempts=8, delay=0.1)
                self.send_response(200)
                self.send_header('Content-Type', 'video/mp2t')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except OSError:
                self.send_error(404, "HLS segment expired or is not available; retry with the latest playlist")
                return

    def proxy_live_stream(self, target_url):
        try:
            import socket
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 256 * 1024)
        except Exception:
            pass

        self.send_response(200)
        self.send_header('Content-Type', 'video/mp2t')
        self.send_header('Accept-Ranges', 'none')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()

        headers = {'User-Agent': USER_AGENT, 'Connection': 'keep-alive'}
        client_alive = True
        reconnect_count = 0
        CHUNK_SIZE = 65424  # Exactly 348 whole 188-byte MPEG-TS packets

        while client_alive and reconnect_count < 250:
            try:
                req = urllib.request.Request(target_url, headers=headers)
                with urllib.request.urlopen(req, timeout=12) as upstream:
                    while client_alive:
                        try:
                            chunk = upstream.read(CHUNK_SIZE)
                        except (ConnectionResetError, urllib.error.URLError, socket.error, TimeoutError, OSError):
                            reconnect_count += 1
                            break
                        if not chunk:
                            reconnect_count += 1
                            break
                        try:
                            self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError, socket.error):
                            client_alive = False
                            break
            except (urllib.error.HTTPError, urllib.error.URLError, socket.error, TimeoutError, OSError):
                reconnect_count += 1
                time.sleep(0.4)

    def proxy_vod_file(self, target_url, content_type):
        try:
            import socket
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass

        headers = {'User-Agent': USER_AGENT}
        if 'Range' in self.headers:
            headers['Range'] = self.headers['Range']

        for attempt in range(3):
            try:
                req = urllib.request.Request(target_url, headers=headers)
                with urllib.request.urlopen(req, timeout=15) as upstream:
                    status = upstream.status
                    self.send_response(status)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')

                    for h in ['Content-Range', 'Content-Length']:
                        val = upstream.headers.get(h)
                        if val:
                            self.send_header(h, val)

                    self.end_headers()

                    while True:
                        chunk = upstream.read(64 * 1024)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                            self.wfile.flush()
                        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.error):
                            break
                    return
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.end_headers()
                return
            except Exception as e:
                if attempt < 2:
                    time.sleep(0.5)
                    continue
                print(f"[VOD ERROR] {target_url} -> {e}")
                if not self.wfile.closed:
                    try:
                        self.send_error(502, f"VOD proxy error: {e}")
                    except Exception:
                        pass

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Gracefully silence normal client connection aborts (WinError 10053, ConnectionResetError, BrokenPipeError)
        exc_type, exc_val, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            return
        if isinstance(exc_val, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
            return
        if exc_val and ('[WinError 10053]' in str(exc_val) or '[WinError 10054]' in str(exc_val)):
            return
        super().handle_error(request, client_address)

if __name__ == '__main__':
    print(f"Starting GPTR TV unified server on port {PORT}...")
    print(f"Static directory: {SITE_DIR}")
    server = ThreadedHTTPServer(('0.0.0.0', PORT), GPTRTVHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()
