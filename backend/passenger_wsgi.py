import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

# Hostinger's Passenger setup expects a WSGI callable, but the app is
# ASGI (FastAPI). a2wsgi bridges the two without giving up FastAPI.
from a2wsgi import ASGIMiddleware

from app.main import app as _asgi_app

application = ASGIMiddleware(_asgi_app)
