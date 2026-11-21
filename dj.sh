#!/usr/bin/env sh
# Fallback runner when Windows application control blocks .venv\Scripts\python.exe.
PY="${MIERUKA_PYTHON:-$APPDATA/uv/python/cpython-3.14-windows-x86_64-none/python.exe}"
PYTHONPATH=".venv/Lib/site-packages" exec "$PY" manage.py "$@"
