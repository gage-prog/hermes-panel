"""Configuration for Hermes Control Panel."""
import os

# Auth
PIN_CODE = os.getenv("HERMES_PANEL_PIN", "654321")
SESSION_SECRET = os.getenv("HERMES_SESSION_SECRET", "hermes-panel-secret-change-me")
SESSION_EXPIRY_HOURS = 24

# Database
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "hermes_panel.db")

# Server
HOST = os.getenv("HERMES_PANEL_HOST", "0.0.0.0")
PORT = int(os.getenv("HERMES_PANEL_PORT", "8777"))
