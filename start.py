#!/usr/bin/env python3
"""
MixingCompass - Port Management and Application Startup Script
"""

import os
import socket
import sys
import subprocess
import psutil
import time
import platform
import shutil
import pathlib
from typing import Optional, List

# Disable Python bytecode generation in development to avoid cache issues
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'


class PortManager:
    """Port management utility for the application"""

    def __init__(self, default_port: int = 8200):
        self.default_port = default_port
        self.is_windows = platform.system() == "Windows"

    def is_port_in_use(self, port: int) -> bool:
        """Check if a port is currently in use"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            result = sock.connect_ex(('localhost', port))
            return result == 0

    def find_processes_using_port(self, port: int) -> List[int]:
        """Find all process IDs using the specified port (Windows compatible)"""
        processes = []
        try:
            connections = psutil.net_connections(kind='inet')
            for conn in connections:
                if conn.laddr and conn.laddr.port == port:
                    if conn.pid and conn.pid not in processes:
                        processes.append(conn.pid)
        except psutil.AccessDenied:
            print(f"Access denied when checking connections. Trying alternative method...")
            # Alternative method for Windows
            if self.is_windows:
                try:
                    result = subprocess.run(['netstat', '-ano'],
                                          capture_output=True, text=True, timeout=10)
                    for line in result.stdout.split('\n'):
                        if f':{port} ' in line and 'LISTENING' in line:
                            parts = line.split()
                            if len(parts) >= 5:
                                try:
                                    pid = int(parts[-1])
                                    if pid not in processes:
                                        processes.append(pid)
                                except ValueError:
                                    continue
                except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
                    print(f"Failed to use netstat. Manual process detection required.")
        except Exception as e:
            print(f"Error finding processes on port {port}: {e}")

        return processes

    def kill_process_on_port(self, port: int, force: bool = True) -> bool:
        """Kill all processes using the specified port"""
        pids = self.find_processes_using_port(port)
        if not pids:
            print(f"No process found using port {port}.")
            return True

        success = True
        for pid in pids:
            try:
                process = psutil.Process(pid)
                process_name = process.name() if hasattr(process, 'name') else 'unknown'
                print(f"Found process {pid} ({process_name}) using port {port}.")

                if not force:
                    response = input(f"Kill process {pid} ({process_name})? (y/n): ").lower()
                    if response != 'y':
                        print(f"Skipping process {pid}")
                        continue

                print(f"Terminating process {pid}...")

                # First try graceful termination
                process.terminate()

                # Wait up to 5 seconds for graceful termination
                try:
                    process.wait(timeout=5)
                    print(f"Process {pid} terminated gracefully.")
                except psutil.TimeoutExpired:
                    print(f"Process {pid} did not terminate gracefully. Force killing...")
                    process.kill()
                    try:
                        process.wait(timeout=3)
                        print(f"Process {pid} was force killed.")
                    except psutil.TimeoutExpired:
                        print(f"Failed to force kill process {pid}.")
                        success = False

            except psutil.NoSuchProcess:
                print(f"Process {pid} already terminated.")
            except psutil.AccessDenied as e:
                print(f"Access denied when trying to terminate process {pid}: {e}")
                if self.is_windows:
                    print(f"Try running as Administrator to terminate process {pid}")
                success = False
            except Exception as e:
                print(f"Unexpected error terminating process {pid}: {e}")
                success = False

        return success

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

    def prepare_port(self, port: int = None, force_kill: bool = True, allow_alternative: bool = False) -> int:
        """
        Prepare a port for use, with options for forced clearing

        Args:
            port: Target port number
            force_kill: If True, kill processes without asking
            allow_alternative: If True, find alternative port when clearing fails

        Returns:
            Available port number
        """
        if port is None:
            port = self.default_port

        if self.is_port_in_use(port):
            print(f"Port {port} is in use.")

            if force_kill:
                print(f"Force clearing port {port}...")
                if self.kill_process_on_port(port, force=True):
                    # Wait for port to be freed
                    for attempt in range(5):
                        time.sleep(1)
                        if not self.is_port_in_use(port):
                            print(f"Port {port} is now available.")
                            return port
                        print(f"Waiting for port {port} to be freed... (attempt {attempt + 1}/5)")

                    # Port still in use after multiple attempts
                    print(f"Port {port} still in use after clearing processes.")
                    if allow_alternative:
                        print(f"Searching for alternative port...")
                        available_port = self.get_available_port(port + 1)
                        print(f"Using alternative port: {available_port}")
                        return available_port
                    else:
                        raise RuntimeError(f"Failed to clear port {port} and alternatives not allowed")
                else:
                    # Failed to kill processes
                    if allow_alternative:
                        print(f"Failed to clear port {port}. Searching for alternative...")
                        available_port = self.get_available_port(port + 1)
                        print(f"Using alternative port: {available_port}")
                        return available_port
                    else:
                        raise RuntimeError(f"Failed to clear port {port} and alternatives not allowed")
            else:
                # Interactive mode - ask user
                response = input(f"Port {port} is in use. Clear it? (y/n): ").lower()
                if response == 'y':
                    if self.kill_process_on_port(port, force=False):
                        time.sleep(2)
                        if not self.is_port_in_use(port):
                            print(f"Port {port} is now available.")
                            return port

                # User declined or clearing failed
                if allow_alternative:
                    available_port = self.get_available_port(port + 1)
                    print(f"Using alternative port: {available_port}")
                    return available_port
                else:
                    raise RuntimeError(f"Port {port} is in use and clearing was declined")

        print(f"Port {port} is available.")
        return port


def clear_python_cache():
    """Clear Python bytecode cache to ensure code changes are reflected"""
    print("Clearing Python cache...")
    cache_cleared = False

    for cache_dir in pathlib.Path('app').rglob('__pycache__'):
        try:
            shutil.rmtree(cache_dir)
            print(f"  [OK] Cleared: {cache_dir}")
            cache_cleared = True
        except Exception as e:
            print(f"  [WARNING] Could not clear {cache_dir}: {e}")

    if not cache_cleared:
        print("  No cache found (this is normal on first run)")
    else:
        print("Cache cleared successfully.")


def start_application(port: int):
    """Start the FastAPI application"""
    # Clear Python cache before starting
    clear_python_cache()

    print(f"\nStarting MixingCompass on port {port}...")

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
    parser.add_argument("--force-kill", "-f", action="store_true", default=True,
                       help="Force kill processes using the target port (default: True)")
    parser.add_argument("--no-force", action="store_true",
                       help="Disable force kill, ask user interactively")
    parser.add_argument("--allow-alternative", "-a", action="store_true",
                       help="Allow using alternative ports if target port cannot be cleared")
    parser.add_argument("--clear-port-only", "-c", action="store_true",
                       help="Only clear the port, don't start the application")

    args = parser.parse_args()

    # Handle conflicting options
    if args.no_force:
        force_kill = False
    else:
        force_kill = args.force_kill

    port_manager = PortManager(args.port)

    try:
        if args.clear_port_only:
            # Just clear the port and exit
            print(f"Clearing port {args.port}...")
            if port_manager.is_port_in_use(args.port):
                success = port_manager.kill_process_on_port(args.port, force=force_kill)
                if success:
                    print(f"Port {args.port} cleared successfully.")
                else:
                    print(f"Failed to clear port {args.port}.")
                    sys.exit(1)
            else:
                print(f"Port {args.port} is already available.")
            return

        # Prepare the port
        available_port = port_manager.prepare_port(
            port=args.port,
            force_kill=force_kill,
            allow_alternative=args.allow_alternative
        )

        # Start the application
        start_application(available_port)

    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()