import os
import sys

# Vercel runs from repo root; ensure backend/ and project root are importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(ROOT, "backend")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.main import app  # noqa: E402  — Vercel expects `app`

# Vercel Python runtime looks for `app` or `handler`
handler = app
