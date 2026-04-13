#!/usr/bin/env python3
"""Entry point for running hermes_panel as a module: python -m hermes_panel"""

import argparse
import logging
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(__file__).rsplit('/', 2)[0])

from hermes_panel.app import run

def main():
    parser = argparse.ArgumentParser(description='Hermes Panel - Web Dashboard')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8080, help='Port to run on (default: 8080)')
    parser.add_argument('--open', action='store_true', help='Open browser automatically')
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    if args.open:
        import webbrowser
        import threading
        import time
        
        def delayed_open():
            time.sleep(1.5)
            webbrowser.open(f'http://{args.host}:{args.port}')
        
        threading.Thread(target=delayed_open, daemon=True).start()
    
    print(f"Starting Hermes Panel at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop")
    
    try:
        run(host=args.host, port=args.port)
    except KeyboardInterrupt:
        print("\nShutting down Hermes Panel...")

if __name__ == '__main__':
    main()
