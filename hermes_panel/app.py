#!/usr/bin/env python3
"""
Hermes Panel - Web Dashboard for monitoring Hermes Agent activities.

Provides a web interface with Chat, Agents, and Projects tabs.
Uses Python's built-in http.server (no external dependencies).
"""

import html
import json
import logging
import os
import sqlite3
import threading
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, List, Optional

from hermes_constants import get_hermes_home

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

HERMES_HOME = get_hermes_home()
STATE_DB = HERMES_HOME / "state.db"
CRON_JOBS_FILE = HERMES_HOME / "cron" / "jobs.json"
SKILLS_DIR = HERMES_HOME / "skills"

# Thread-safe active agents tracking
_active_agents: Dict[str, Dict] = {}
_active_agents_lock = threading.Lock()


def get_db_connection() -> sqlite3.Connection:
    """Get a connection to the Hermes state database."""
    conn = sqlite3.connect(str(STATE_DB), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# =============================================================================
# API Functions
# =============================================================================

def get_chat_sessions() -> Dict[str, Any]:
    """Get all chat sessions, most recent first."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, source, user_id, model, title, started_at, ended_at,
                   message_count, tool_call_count, input_tokens, output_tokens,
                   estimated_cost_usd, end_reason
            FROM sessions
            ORDER BY started_at DESC
            LIMIT 100
        """)
        sessions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        for session in sessions:
            if session.get("started_at"):
                session["started_at"] = datetime.fromtimestamp(session["started_at"]).isoformat()
            if session.get("ended_at"):
                session["ended_at"] = datetime.fromtimestamp(session["ended_at"]).isoformat()
        
        return {"sessions": sessions, "count": len(sessions)}
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {e}")
        return {"error": str(e), "sessions": [], "count": 0}


def get_chat_session(session_id: str) -> Dict[str, Any]:
    """Get messages for a specific chat session."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        session_row = cursor.fetchone()
        session = dict(session_row) if session_row else None
        
        cursor.execute("""
            SELECT id, role, content, tool_name, timestamp, token_count,
                   finish_reason, reasoning
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
        """, (session_id,))
        messages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        if session:
            if session.get("started_at"):
                session["started_at"] = datetime.fromtimestamp(session["started_at"]).isoformat()
            if session.get("ended_at"):
                session["ended_at"] = datetime.fromtimestamp(session["ended_at"]).isoformat()
        
        for msg in messages:
            if msg.get("timestamp"):
                msg["timestamp"] = datetime.fromtimestamp(msg["timestamp"]).isoformat()
        
        return {"session": session, "messages": messages}
    except Exception as e:
        logger.error(f"Error fetching chat session {session_id}: {e}")
        return {"error": str(e)}


def get_active_agents() -> Dict[str, Any]:
    """Get currently active agents."""
    with _active_agents_lock:
        agents = list(_active_agents.values())
    return {"agents": agents, "count": len(agents)}


def get_agents_history() -> Dict[str, Any]:
    """Get agent execution history from recent sessions."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, source, model, title, started_at, ended_at,
                   message_count, tool_call_count, end_reason
            FROM sessions
            WHERE source IN ('cli', 'subagent', 'worktree')
            ORDER BY started_at DESC
            LIMIT 50
        """)
        history = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        for item in history:
            if item.get("started_at"):
                item["started_at"] = datetime.fromtimestamp(item["started_at"]).isoformat()
            if item.get("ended_at"):
                item["ended_at"] = datetime.fromtimestamp(item["ended_at"]).isoformat()
        
        return {"history": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Error fetching agent history: {e}")
        return {"error": str(e), "history": [], "count": 0}


def get_projects() -> Dict[str, Any]:
    """Get all projects (skills grouped by category)."""
    try:
        projects = []
        
        if SKILLS_DIR.exists():
            for category in SKILLS_DIR.iterdir():
                if category.is_dir() and not category.name.startswith("."):
                    category_skills = []
                    for skill in category.iterdir():
                        if skill.is_dir() and not skill.name.startswith("."):
                            skill_info = {
                                "name": skill.name,
                                "path": str(skill),
                                "category": category.name
                            }
                            skill_readme = skill / "README.md"
                            if skill_readme.exists():
                                skill_info["description"] = skill_readme.read_text()[:200]
                            category_skills.append(skill_info)
                    
                    if category_skills:
                        projects.append({
                            "category": category.name,
                            "skills": category_skills,
                            "count": len(category_skills)
                        })
        
        context_files = []
        for pattern in ["AGENTS.md", "PROJECT.md", ".context"]:
            for cf in HERMES_HOME.glob(f"**/{pattern}"):
                context_files.append({
                    "name": cf.name,
                    "path": str(cf),
                    "modified": datetime.fromtimestamp(cf.stat().st_mtime).isoformat()
                })
        
        return {
            "projects": projects,
            "context_files": context_files,
            "total_skills": sum(p["count"] for p in projects)
        }
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        return {"error": str(e), "projects": [], "context_files": []}


def get_project(project_name: str) -> Dict[str, Any]:
    """Get details for a specific project/skill."""
    try:
        skill_path = SKILLS_DIR / project_name
        if not skill_path.exists():
            for category in SKILLS_DIR.iterdir():
                if category.is_dir():
                    for skill in category.iterdir():
                        if skill.is_dir() and skill.name == project_name:
                            skill_path = skill
                            break
        
        if not skill_path.exists():
            return {"error": "Project not found"}
        
        skill_info = {
            "name": skill_path.name,
            "path": str(skill_path),
            "category": skill_path.parent.name
        }
        
        files = []
        for f in skill_path.rglob("*"):
            if f.is_file() and not f.name.startswith("."):
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "size": f.stat().st_size
                })
        skill_info["files"] = files
        
        readme = skill_path / "README.md"
        if readme.exists():
            skill_info["readme"] = readme.read_text()
        
        return skill_info
    except Exception as e:
        logger.error(f"Error fetching project {project_name}: {e}")
        return {"error": str(e)}


def get_cron_jobs() -> Dict[str, Any]:
    """Get all scheduled cron jobs."""
    try:
        if not CRON_JOBS_FILE.exists():
            return {"jobs": [], "count": 0}
        
        with open(CRON_JOBS_FILE) as f:
            jobs_data = json.load(f)
        
        jobs = jobs_data if isinstance(jobs_data, list) else [jobs_data]
        return {"jobs": jobs, "count": len(jobs)}
    except Exception as e:
        logger.error(f"Error fetching cron jobs: {e}")
        return {"error": str(e), "jobs": [], "count": 0}


def get_system_stats() -> Dict[str, Any]:
    """Get system statistics."""
    try:
        stats = {
            "timestamp": datetime.now().isoformat(),
            "active_agents": len(_active_agents),
            "hermes_home": str(HERMES_HOME)
        }
        
        if STATE_DB.exists():
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM sessions")
            stats["total_sessions"] = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM messages")
            stats["total_messages"] = cursor.fetchone()[0]
            
            conn.close()
        
        if CRON_JOBS_FILE.exists():
            with open(CRON_JOBS_FILE) as f:
                jobs = json.load(f)
                stats["total_cron_jobs"] = len(jobs) if isinstance(jobs, list) else 1
        
        if SKILLS_DIR.exists():
            stats["total_skills"] = sum(1 for _ in SKILLS_DIR.rglob("SKILL.md"))
        
        return stats
    except Exception as e:
        logger.error(f"Error fetching system stats: {e}")
        return {"error": str(e)}


# =============================================================================
# HTTP Handler
# =============================================================================

class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Hermes dashboard."""
    
    def log_message(self, format, *args):
        """Override to use our logger."""
        logger.info(f"{self.address_string()} - {format % args}")
    
    def send_json_response(self, data: Dict, status: int = 200):
        """Send a JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def send_html_response(self, html: str, status: int = 200):
        """Send an HTML response."""
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(html.encode())
    
    def send_file_response(self, path: str, content_type: str):
        """Send a file response."""
        try:
            with open(path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", len(content))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, "File not found")
    
    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/" or self.path == "/index.html":
            self.serve_index()
        elif self.path == "/api/chat/sessions":
            self.send_json_response(get_chat_sessions())
        elif self.path.startswith("/api/chat/session/"):
            session_id = self.path[len("/api/chat/session/"):]
            self.send_json_response(get_chat_session(session_id))
        elif self.path == "/api/agents/active":
            self.send_json_response(get_active_agents())
        elif self.path == "/api/agents/history":
            self.send_json_response(get_agents_history())
        elif self.path == "/api/projects/list":
            self.send_json_response(get_projects())
        elif self.path.startswith("/api/projects/"):
            project_name = self.path[len("/api/projects/"):]
            self.send_json_response(get_project(project_name))
        elif self.path == "/api/cron/jobs":
            self.send_json_response(get_cron_jobs())
        elif self.path == "/api/system/stats":
            self.send_json_response(get_system_stats())
        elif self.path == "/health":
            self.send_json_response({"status": "ok", "timestamp": datetime.now().isoformat()})
        elif self.path.startswith("/static/css/"):
            filename = self.path.split("/")[-1]
            filepath = Path(__file__).parent / "static" / "css" / filename
            self.send_file_response(str(filepath), "text/css")
        elif self.path.startswith("/static/js/"):
            filename = self.path.split("/")[-1]
            filepath = Path(__file__).parent / "static" / "js" / filename
            self.send_file_response(str(filepath), "application/javascript")
        else:
            self.send_error(404, "Not found")
    
    def serve_index(self):
        """Serve the main dashboard page."""
        html_path = Path(__file__).parent / "templates" / "index.html"
        with open(html_path, "r") as f:
            html_content = f.read()
        self.send_html_response(html_content)


# =============================================================================
# Server
# =============================================================================

class DashboardServer:
    """Hermes Panel HTTP server."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8080):
        self.host = host
        self.port = port
        self.server: Optional[HTTPServer] = None
    
    def start(self):
        """Start the server."""
        self.server = HTTPServer((self.host, self.port), DashboardHandler)
        logger.info(f"Starting Hermes Panel at http://{self.host}:{self.port}")
        print(f"Starting Hermes Panel at http://{self.host}:{self.port}")
        print("Press Ctrl+C to stop")
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down Hermes Panel...")
            self.stop()
    
    def stop(self):
        """Stop the server."""
        if self.server:
            self.server.shutdown()
            self.server = None


def run(host: str = "127.0.0.1", port: int = 8080):
    """Run the Hermes Panel server."""
    server = DashboardServer(host=host, port=port)
    server.start()


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Hermes Panel - Web Dashboard")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8080, help="Port to run on")
    args = parser.parse_args()
    
    run(host=args.host, port=args.port)
