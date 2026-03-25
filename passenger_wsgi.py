import os
import sys


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.chdir(BASE_DIR)
os.environ.setdefault("PYTHON_EGG_CACHE", os.path.join(BASE_DIR, ".python-eggs"))

from wsgi import application
