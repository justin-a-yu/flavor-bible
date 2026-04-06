#!/usr/bin/env python3
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from http.server import HTTPServer, SimpleHTTPRequestHandler
HTTPServer(('', 8765), SimpleHTTPRequestHandler).serve_forever()
