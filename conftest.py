import sys
import pathlib

# Ensure server/ is on path and repo root is on path for `pytest test/server`
root = pathlib.Path(__file__).parent
server = root / "server"
if str(server) not in sys.path:
    sys.path.insert(0, str(server))
if str(root) not in sys.path:
    sys.path.insert(0, str(root))
