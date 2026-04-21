# Hermes Control Panel

Web dashboard for monitoring and managing AI agent activities.

## Features

- **Dashboard** — Agent/project/task stats at a glance
- **Agents** — Register, monitor, and manage AI agents
- **Projects** — Organize work into projects with task tracking
- **Tasks** — Create, assign, and track task progress
- **Chat** — Communicate with agents
- **Alerts** — System alerts and notifications

## Tech Stack

- **Backend:** FastAPI + SQLite
- **Frontend:** Vanilla JS SPA (no build step)
- **Auth:** PIN-based session tokens
- **Deploy:** Fly.io (Docker)

## Running Locally

```bash
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8080
```

Set PIN via environment variable:
```bash
export HERMES_PANEL_PIN=654321
```

## Deploying to Fly.io

```bash
fly deploy
```

Set PIN as a secret (overrides the default):
```bash
fly secrets set HERMES_PANEL_PIN=your_pin_here
```
