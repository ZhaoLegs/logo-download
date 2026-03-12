import atexit
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent
PORT = 5173
BACKEND_PORT = 3000
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
NODE_BINARY = shutil.which("node")
backend_process: subprocess.Popen[str] | None = None


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def ensure_backend_running() -> None:
    global backend_process

    if is_port_open(BACKEND_PORT):
        return

    if NODE_BINARY is None:
        raise RuntimeError("Node.js is required to run the logo-download backend")

    if backend_process and backend_process.poll() is None:
        return

    backend_process = subprocess.Popen(
        [NODE_BINARY, str(ROOT_DIR / "server.js")],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )

    deadline = time.time() + 10
    while time.time() < deadline:
        if is_port_open(BACKEND_PORT):
            return
        if backend_process.poll() is not None:
            raise RuntimeError("Node backend exited before becoming ready")
        time.sleep(0.2)

    raise RuntimeError("Timed out waiting for Node backend on port 3000")


def stop_backend() -> None:
    global backend_process

    if backend_process and backend_process.poll() is None:
        backend_process.terminate()
        try:
            backend_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            backend_process.kill()
            backend_process.wait(timeout=3)

    backend_process = None


atexit.register(stop_backend)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        self.proxy_request()

    def do_HEAD(self) -> None:
        self.proxy_request(send_body=False)

    def proxy_request(self, send_body: bool = True) -> None:
        try:
            ensure_backend_running()
        except Exception as exc:
            body = f"Backend startup failed: {exc}\n".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if send_body:
                self.wfile.write(body)
            return

        upstream = urllib.request.Request(
            f"{BACKEND_URL}{self.path}",
            method=self.command,
            headers={
                "User-Agent": self.headers.get("User-Agent", "logo-download-python-proxy"),
                "Accept": self.headers.get("Accept", "*/*"),
            },
        )

        try:
            with urllib.request.urlopen(upstream, timeout=30) as response:
                body = response.read()
                self.send_response(response.status)

                for header, value in response.headers.items():
                    header_lower = header.lower()
                    if header_lower in {"connection", "transfer-encoding", "server", "date"}:
                        continue
                    self.send_header(header, value)

                self.send_header("Content-Length", str(len(body)))
                self.end_headers()

                if send_body:
                    self.wfile.write(body)
        except urllib.error.HTTPError as exc:
            body = exc.read()
            self.send_response(exc.code)

            for header, value in exc.headers.items():
                header_lower = header.lower()
                if header_lower in {"connection", "transfer-encoding", "server", "date"}:
                    continue
                self.send_header(header, value)

            self.send_header("Content-Length", str(len(body)))
            self.end_headers()

            if send_body:
                self.wfile.write(body)
        except Exception as exc:
            body = f"Proxy request failed: {exc}\n".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if send_body:
                self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"logo-download compatibility server running at http://localhost:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
