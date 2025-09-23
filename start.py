#!/usr/bin/env python3
"""
MixingCompass - Port Management and Application Startup Script
"""

import socket
import sys
import subprocess
import psutil
import time
from typing import Optional


class PortManager:
    """Port management utility for the application"""

    def __init__(self, default_port: int = 8200):
        self.default_port = default_port

    def is_port_in_use(self, port: int) -> bool:
        """Check if a port is currently in use"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            result = sock.connect_ex(('localhost', port))
            return result == 0

    def find_process_using_port(self, port: int) -> Optional[int]:
        """Find the process ID using the specified port"""
        for conn in psutil.net_connections():
            if conn.laddr.port == port:
                return conn.pid
        return None

    def kill_process_on_port(self, port: int) -> bool:
        """Kill the process using the specified port"""
        pid = self.find_process_using_port(port)
        if pid:
            try:
                process = psutil.Process(pid)
                print(f"Found process {pid} using port {port}. Terminating...")

                # First try graceful termination
                process.terminate()

                # Wait up to 5 seconds for graceful termination
                try:
                    process.wait(timeout=5)
                    print(f"Process {pid} terminated gracefully.")
                    return True
                except psutil.TimeoutExpired:
                    print(f"Process {pid} did not terminate gracefully. Force killing...")
                    process.kill()
                    try:
                        process.wait(timeout=3)
                        print(f"Process {pid} was force killed.")
                        return True
                    except psutil.TimeoutExpired:
                        print(f"Failed to force kill process {pid}.")
                        return False

            except psutil.NoSuchProcess:
                print(f"Process {pid} already terminated.")
                return True
            except psutil.AccessDenied as e:
                print(f"Access denied when trying to terminate process {pid}: {e}")
                return False
            except Exception as e:
                print(f"Unexpected error terminating process {pid}: {e}")
                return False
        else:
            print(f"No process found using port {port}.")
            return False

    def get_available_port(self, start_port: int = None) -> int:
        """Find an available port starting from the specified port"""
        if start_port is None:
            start_port = self.default_port

        port = start_port
        while port < start_port + 100:  # Try 100 ports
            if not self.is_port_in_use(port):
                return port
            port += 1

        raise RuntimeError(f"No available port found in range {start_port}-{start_port + 99}")

    def prepare_port(self, port: int = None, force_kill: bool = True) -> int:
        """Prepare a port for use, automatically killing existing processes if needed"""
        if port is None:
            port = self.default_port

        if self.is_port_in_use(port):
            print(f"Port {port} is in use. Attempting to free it...")
            if self.kill_process_on_port(port):
                time.sleep(2)  # Wait for port to be freed
                if not self.is_port_in_use(port):
                    print(f"Port {port} is now available.")
                    return port
                else:
                    print(f"Port {port} still in use after termination. Waiting...")
                    time.sleep(3)  # Wait a bit more
                    if not self.is_port_in_use(port):
                        print(f"Port {port} is now available.")
                        return port

            print(f"Failed to free port {port}. Finding alternative...")
            # Find alternative port as fallback
            available_port = self.get_available_port(port + 1)
            print(f"Using alternative port: {available_port}")
            return available_port

        print(f"Port {port} is available.")
        return port


def start_application(port: int):
    """Start the FastAPI application"""
    print(f"Starting MixingCompass on port {port}...")

    try:
        # Start uvicorn server
        cmd = [
            sys.executable, "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", str(port),
            "--reload"
        ]

        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Failed to start application: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nApplication stopped by user.")
        sys.exit(0)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Start MixingCompass application")
    parser.add_argument("--port", "-p", type=int, default=8200,
                       help="Port to run the application on (default: 8200)")
    parser.add_argument("--force-kill", "-f", action="store_true",
                       help="Force kill processes using the target port")

    args = parser.parse_args()

    port_manager = PortManager(args.port)

    try:
        # Prepare the port (force_kill is now default True)
        available_port = port_manager.prepare_port(args.port)

        # Start the application
        start_application(available_port)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()