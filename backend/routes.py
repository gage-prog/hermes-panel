"""API routes for Hermes Control Panel."""
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.auth import verify_pin, create_session, validate_session, destroy_session

router = APIRouter(prefix="/api")


# --- Auth dependency ---
async def require_auth(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = request.cookies.get("session_token", "")
    if not validate_session(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


# --- Pydantic models ---
class PinLogin(BaseModel):
    pin: str

class AgentCreate(BaseModel):
    name: str
    type: str = "subagent"
    model: str = ""
    provider: str = ""

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    priority: str = "medium"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    project_id: Optional[str] = None
    agent_id: Optional[str] = None
    priority: str = "medium"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    agent_id: Optional[str] = None
    project_id: Optional[str] = None

class ChatMessage(BaseModel):
    content: str

class AlertCreate(BaseModel):
    title: str
    detail: str = ""
    level: str = "info"


# --- Auth routes ---
@router.post("/auth/login")
async def login(body: PinLogin):
    if not verify_pin(body.pin):
        raise HTTPException(status_code=403, detail="Invalid PIN")
    token = create_session()
    return {"token": token}

@router.post("/auth/logout")
async def logout(token: str = Depends(require_auth)):
    destroy_session(token)
    return {"ok": True}

@router.get("/auth/check")
async def auth_check(token: str = Depends(require_auth)):
    return {"authenticated": True}


# --- Dashboard ---
@router.get("/dashboard")
async def dashboard(token: str = Depends(require_auth)):
    db = get_db()
    try:
        agents_total = db.execute("SELECT COUNT(*) as c FROM agents").fetchone()["c"]
        agents_active = db.execute("SELECT COUNT(*) as c FROM agents WHERE status='active'").fetchone()["c"]
        projects_total = db.execute("SELECT COUNT(*) as c FROM projects").fetchone()["c"]
        projects_active = db.execute("SELECT COUNT(*) as c FROM projects WHERE status='active'").fetchone()["c"]
        tasks_total = db.execute("SELECT COUNT(*) as c FROM tasks").fetchone()["c"]
        tasks_pending = db.execute("SELECT COUNT(*) as c FROM tasks WHERE status='pending'").fetchone()["c"]
        tasks_progress = db.execute("SELECT COUNT(*) as c FROM tasks WHERE status='in_progress'").fetchone()["c"]
        tasks_done = db.execute("SELECT COUNT(*) as c FROM tasks WHERE status='completed'").fetchone()["c"]
        alerts_unack = db.execute("SELECT COUNT(*) as c FROM alerts WHERE acknowledged=0").fetchone()["c"]

        recent_activity = [dict(r) for r in db.execute(
            "SELECT a.*, ag.name as agent_name FROM activity_log a LEFT JOIN agents ag ON a.agent_id=ag.id ORDER BY a.timestamp DESC LIMIT 10"
        ).fetchall()]

        recent_alerts = [dict(r) for r in db.execute(
            "SELECT * FROM alerts WHERE acknowledged=0 ORDER BY created_at DESC LIMIT 5"
        ).fetchall()]

        # System info
        import os
        system_info = {
            "model": os.getenv("HERMES_MODEL", "xiaomi/mimo-v2-pro"),
            "provider": os.getenv("HERMES_PROVIDER", "nous"),
            "version": "1.0.0",
        }

        return {
            "agents": {"total": agents_total, "active": agents_active},
            "projects": {"total": projects_total, "active": projects_active},
            "tasks": {"total": tasks_total, "pending": tasks_pending, "in_progress": tasks_progress, "completed": tasks_done},
            "alerts": {"unacknowledged": alerts_unack, "recent": recent_alerts},
            "recent_activity": recent_activity,
            "system": system_info,
        }
    finally:
        db.close()


# --- Agents CRUD ---
@router.get("/agents")
async def list_agents(token: str = Depends(require_auth)):
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM agents ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()

@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, token: str = Depends(require_auth)):
    db = get_db()
    try:
        row = db.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Agent not found")
        agent = dict(row)
        agent["tasks"] = [dict(r) for r in db.execute(
            "SELECT * FROM tasks WHERE agent_id=? ORDER BY created_at DESC", (agent_id,)
        ).fetchall()]
        agent["activity"] = [dict(r) for r in db.execute(
            "SELECT * FROM activity_log WHERE agent_id=? ORDER BY timestamp DESC LIMIT 20", (agent_id,)
        ).fetchall()]
        return agent
    finally:
        db.close()

@router.post("/agents")
async def create_agent(body: AgentCreate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        aid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO agents (id, name, type, model, provider, status, last_seen) VALUES (?, ?, ?, ?, ?, 'idle', ?)",
            (aid, body.name, body.type, body.model, body.provider, datetime.utcnow().isoformat())
        )
        _log_activity(db, aid, "created", f"Agent '{body.name}' registered")
        db.commit()
        return {"id": aid, "name": body.name}
    finally:
        db.close()

@router.patch("/agents/{agent_id}")
async def update_agent(agent_id: str, body: AgentUpdate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, "No fields to update")
        sets = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [agent_id]
        db.execute(f"UPDATE agents SET {sets}, last_seen=datetime('now') WHERE id=?", vals)
        if "status" in updates:
            _log_activity(db, agent_id, "status_change", f"Status → {updates['status']}")
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute("DELETE FROM chat_messages WHERE agent_id=?", (agent_id,))
        db.execute("DELETE FROM activity_log WHERE agent_id=?", (agent_id,))
        db.execute("UPDATE tasks SET agent_id=NULL WHERE agent_id=?", (agent_id,))
        db.execute("DELETE FROM agents WHERE id=?", (agent_id,))
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Projects CRUD ---
@router.get("/projects")
async def list_projects(token: str = Depends(require_auth)):
    db = get_db()
    try:
        rows = db.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        projects = []
        for r in rows:
            p = dict(r)
            stats = db.execute(
                "SELECT status, COUNT(*) as c FROM tasks WHERE project_id=? GROUP BY status", (p["id"],)
            ).fetchall()
            p["task_stats"] = {s["status"]: s["c"] for s in stats}
            projects.append(p)
        return projects
    finally:
        db.close()

@router.get("/projects/{project_id}")
async def get_project(project_id: str, token: str = Depends(require_auth)):
    db = get_db()
    try:
        row = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Project not found")
        p = dict(row)
        p["tasks"] = [dict(r) for r in db.execute(
            "SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.agent_id=a.id WHERE t.project_id=? ORDER BY t.created_at DESC", (project_id,)
        ).fetchall()]
        return p
    finally:
        db.close()

@router.post("/projects")
async def create_project(body: ProjectCreate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        pid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO projects (id, name, description, priority) VALUES (?, ?, ?, ?)",
            (pid, body.name, body.description, body.priority)
        )
        _log_activity(db, None, "project_created", f"Project '{body.name}' created")
        db.commit()
        return {"id": pid, "name": body.name}
    finally:
        db.close()

@router.patch("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, "No fields to update")
        updates["updated_at"] = datetime.utcnow().isoformat()
        sets = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [project_id]
        db.execute(f"UPDATE projects SET {sets} WHERE id=?", vals)
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute("DELETE FROM tasks WHERE project_id=?", (project_id,))
        db.execute("DELETE FROM projects WHERE id=?", (project_id,))
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Tasks CRUD ---
@router.get("/tasks")
async def list_tasks(status: Optional[str] = None, project_id: Optional[str] = None, token: str = Depends(require_auth)):
    db = get_db()
    try:
        q = "SELECT t.*, a.name as agent_name, p.name as project_name FROM tasks t LEFT JOIN agents a ON t.agent_id=a.id LEFT JOIN projects p ON t.project_id=p.id WHERE 1=1"
        params = []
        if status:
            q += " AND t.status=?"
            params.append(status)
        if project_id:
            q += " AND t.project_id=?"
            params.append(project_id)
        q += " ORDER BY t.created_at DESC"
        return [dict(r) for r in db.execute(q, params).fetchall()]
    finally:
        db.close()

@router.post("/tasks")
async def create_task(body: TaskCreate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        tid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO tasks (id, title, description, project_id, agent_id, priority) VALUES (?, ?, ?, ?, ?, ?)",
            (tid, body.title, body.description, body.project_id, body.agent_id, body.priority)
        )
        _log_activity(db, body.agent_id, "task_created", f"Task '{body.title}' created")
        db.commit()
        return {"id": tid, "title": body.title}
    finally:
        db.close()

@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            raise HTTPException(400, "No fields to update")
        updates["updated_at"] = datetime.utcnow().isoformat()
        if updates.get("status") == "completed":
            updates["completed_at"] = datetime.utcnow().isoformat()
        sets = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [task_id]
        db.execute(f"UPDATE tasks SET {sets} WHERE id=?", vals)
        if "status" in updates:
            task = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if task:
                _log_activity(db, task["agent_id"], "task_status", f"Task '{task['title']}' → {updates['status']}")
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Chat ---
@router.get("/chat/{agent_id}")
async def get_chat(agent_id: str, limit: int = 50, token: str = Depends(require_auth)):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT * FROM chat_messages WHERE agent_id=? ORDER BY timestamp DESC LIMIT ?", (agent_id, limit)
        ).fetchall()
        return list(reversed([dict(r) for r in rows]))
    finally:
        db.close()

@router.post("/chat/{agent_id}")
async def send_chat(agent_id: str, body: ChatMessage, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute(
            "INSERT INTO chat_messages (agent_id, sender, content) VALUES (?, 'user', ?)",
            (agent_id, body.content)
        )
        _log_activity(db, agent_id, "chat_message", f"User sent message")
        # Simulated agent response (placeholder for real agent integration)
        db.execute(
            "INSERT INTO chat_messages (agent_id, sender, content, timestamp) VALUES (?, 'agent', ?, datetime('now', '+1 second'))",
            (agent_id, f"[Echo] Received: {body.content[:200]}")
        )
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Alerts ---
@router.get("/alerts")
async def list_alerts(token: str = Depends(require_auth)):
    db = get_db()
    try:
        return [dict(r) for r in db.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50").fetchall()]
    finally:
        db.close()

@router.post("/alerts")
async def create_alert(body: AlertCreate, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute("INSERT INTO alerts (title, detail, level) VALUES (?, ?, ?)", (body.title, body.detail, body.level))
        db.commit()
        return {"ok": True}
    finally:
        db.close()

@router.post("/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: int, token: str = Depends(require_auth)):
    db = get_db()
    try:
        db.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (alert_id,))
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Activity log ---
@router.get("/activity")
async def list_activity(limit: int = 50, token: str = Depends(require_auth)):
    db = get_db()
    try:
        return [dict(r) for r in db.execute(
            "SELECT a.*, ag.name as agent_name FROM activity_log a LEFT JOIN agents ag ON a.agent_id=ag.id ORDER BY a.timestamp DESC LIMIT ?", (limit,)
        ).fetchall()]
    finally:
        db.close()


def _log_activity(db, agent_id, action, detail, level="info"):
    db.execute(
        "INSERT INTO activity_log (agent_id, action, detail, level) VALUES (?, ?, ?, ?)",
        (agent_id, action, detail, level)
    )
