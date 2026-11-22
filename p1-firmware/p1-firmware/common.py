"""Shared helpers: frame signing (HMAC-SHA256) and JSON/CORS replies.
Demo keys only. In production each plug gets its own key, stored in a secure element."""
import hashlib, hmac, json

PLUG_KEY = b"p1-demo-plug-key"     # plug  -> concentrator
CONC_KEY = b"p1-demo-conc-key"     # concentrator -> STEG server


def sign(key, text):
    return hmac.new(key, text.encode(), hashlib.sha256).hexdigest()[:32]


def verify(key, text, sig):
    return hmac.compare_digest(sign(key, text), str(sig))


def reply(handler, obj, code=200):
    b = json.dumps(obj).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")   # the 3D room page polls /api/state
    handler.send_header("Content-Length", str(len(b)))
    handler.end_headers()
    handler.wfile.write(b)


def read_json(handler):
    return json.loads(handler.rfile.read(int(handler.headers.get("Content-Length", 0))))
