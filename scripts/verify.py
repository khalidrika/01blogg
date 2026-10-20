#!/usr/bin/env python3
"""Run all checks with a disposable PostgreSQL database and isolated uploads."""
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / ".verification"
DOCKER = os.environ.get("DOCKER_BIN") or shutil.which("docker")
CONTAINER = os.environ.get("POSTGRES_CONTAINER", "blog-postgres")


def env_values(path):
    values = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def wait_ready(url, process):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError(f"Server exited early. See {LOGS}")
        try:
            with urllib.request.urlopen(url, timeout=1):
                return
        except urllib.error.HTTPError as error:
            if error.code in (400, 401, 404, 405):
                return
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1)
    raise RuntimeError(f"Server did not become ready: {url}")


def main():
    if not DOCKER:
        raise RuntimeError("Docker is required; alternatively set DOCKER_BIN.")
    if not (ROOT / ".env").is_file():
        raise RuntimeError("Create .env using .env.example before verification.")
    for port in (8081, 4201):
        with socket.socket() as connection:
            if connection.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Port {port} is already in use. Stop that test server first.")
    LOGS.mkdir(exist_ok=True)
    database = "blog_verify_" + secrets.token_hex(6)
    env = os.environ.copy()
    env.update(env_values(ROOT / ".env"))
    database_user = env.get("DB_USER", "postgres")
    docker = [DOCKER, "exec", CONTAINER]
    processes = []
    handles = []
    created = False
    with tempfile.TemporaryDirectory(prefix="01blog-verify-") as temporary:
        env.update({
            "DB_URL": f"jdbc:postgresql://localhost:5432/{database}",
            "JWT_SECRET": secrets.token_urlsafe(48),
            "UPLOAD_DIR": temporary,
            "BOOTSTRAP_ADMIN_EMAIL": "admin@verify.example",
            "BOOTSTRAP_ADMIN_USERNAME": "verifyadmin",
            "BOOTSTRAP_ADMIN_PASSWORD": secrets.token_urlsafe(24),
            "CORS_ALLOWED_ORIGINS": "http://localhost:4201",
            "DEBUG": "false",
            "SPRING_DEVTOOLS_RESTART_ENABLED": "false",
        })

        def run(command, cwd, name):
            print(name, flush=True)
            with (LOGS / f"{name}.log").open("w") as output:
                subprocess.run(command, cwd=cwd, env=env, stdout=output,
                               stderr=subprocess.STDOUT, check=True)

        def start(command, cwd, name):
            output = (LOGS / f"{name}.log").open("w")
            handles.append(output)
            process = subprocess.Popen(command, cwd=cwd, env=env, stdout=output,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            processes.append(process)
            return process

        try:
            subprocess.run(docker + ["createdb", "-U", database_user, database], check=True)
            created = True
            print(f"Testing with isolated database {database}", flush=True)
            run(["./mvnw", "-q", "test"], ROOT / "backend", "backend-tests")
            run(["npm", "test", "--", "--watch=false"], ROOT / "frontend", "frontend-tests")
            run(["npm", "run", "build"], ROOT / "frontend", "frontend-build")
            backend = start(["./mvnw", "-q", "spring-boot:run",
                             "-Dspring-boot.run.arguments=--server.port=8081"],
                            ROOT / "backend", "backend-server")
            frontend = start(["npm", "start", "--", "--configuration=e2e", "--port=4201"],
                             ROOT / "frontend", "frontend-server")
            wait_ready("http://localhost:8081/api/posts", backend)
            wait_ready("http://localhost:4201", frontend)
            run(["npm", "run", "test:e2e"], ROOT / "frontend", "browser-tests")
            print(f"All checks passed. Logs: {LOGS}", flush=True)
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
            for handle in handles:
                handle.close()
            if created:
                # Only the randomly named database created by this invocation is removed.
                subprocess.run(docker + ["dropdb", "--force", "-U", database_user, database], check=True)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, KeyboardInterrupt) as error:
        print(f"Verification stopped: {error}. Logs: {LOGS}")
        raise SystemExit(1)
