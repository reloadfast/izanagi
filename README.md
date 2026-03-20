# Izanagi

A self-hosted Unraid template deployment service. Izanagi exposes a simple authenticated REST API that lets coding agents (Claude Code, Aider, etc.) push Unraid Community Applications XML templates to your server and trigger container restarts — all without touching the Unraid UI.

A built-in single-page web UI handles token management, deploy history, and settings.

---

## Quick Start

```bash
git clone https://github.com/reloadfast/izanagi
cd izanagi

# Edit docker-compose.yml and set a strong IZANAGI_BOOTSTRAP_TOKEN
docker compose up -d
```

Open `http://localhost:9731` in your browser.

Use the bootstrap token to create a permanent agent token via **Settings → Tokens → New Token**, then remove `IZANAGI_BOOTSTRAP_TOKEN` from your compose file and restart.

---

## API Reference

All endpoints (except `GET /api/version`) require a `Authorization: Bearer <token>` header.

| Method   | Endpoint                       | Auth | Description                                    |
|----------|--------------------------------|------|------------------------------------------------|
| `GET`    | `/api/version`                 | No   | Returns app name, version, build SHA           |
| `POST`   | `/api/deploy`                  | Yes  | Write an XML template; records history entry   |
| `POST`   | `/api/restart/{container}`     | Yes  | Restart a Docker container via the socket      |
| `POST`   | `/api/tokens`                  | Yes  | Create a new agent token (returned once)       |
| `GET`    | `/api/tokens`                  | Yes  | List all tokens (name, dates — no raw values)  |
| `DELETE` | `/api/tokens/{id}`             | Yes  | Revoke a token                                 |
| `GET`    | `/api/history`                 | Yes  | Recent deploy history (`?limit=N`, default 50) |

### Deploy payload

```json
POST /api/deploy
{
  "template_name": "my-app",
  "xml_content": "<Container>…</Container>"
}
```

Response:
```json
{ "status": "ok", "action": "created", "template_name": "my-app" }
```

`action` is `"created"` on first deploy, `"updated"` on subsequent deploys.

### Restart response

```json
{ "status": "restarted", "container_name": "my-app" }
```

If the container can't be restarted (not found, daemon error, etc.):
```json
{
  "status": "manual_recreate_required",
  "container_name": "my-app",
  "reason": "Container not found"
}
```

---

## Token Setup (for coding agents)

1. Open the Izanagi web UI.
2. Go to the **Tokens** tab.
3. Click **New Token**, enter an agent name (e.g. `"Claude Code"`), click **Generate**.
4. Copy the token — it is shown **only once**.
5. In your agent's configuration, set:

```
IZANAGI_URL=http://<your-unraid-ip>:9731
IZANAGI_TOKEN=<your-token>
```

Then from your agent, deploy a template:

```bash
curl -X POST http://localhost:9731/api/deploy \
  -H "Authorization: Bearer $IZANAGI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template_name":"my-app","xml_content":"<Container>…</Container>"}'
```

---

## Environment Variables

| Variable                  | Default                 | Description                                       |
|---------------------------|-------------------------|---------------------------------------------------|
| `IZANAGI_TEMPLATES_PATH`  | `/templates`            | Directory where XML templates are written         |
| `IZANAGI_DB_PATH`         | `/data/izanagi.db`      | SQLite database file path                         |
| `IZANAGI_PORT`            | `9731`                  | Port the server listens on                        |
| `DOCKER_SOCKET`           | `/var/run/docker.sock`  | Docker socket for container restart               |
| `IZANAGI_BOOTSTRAP_TOKEN` | *(unset)*               | Always-valid token for initial setup (optional)   |
| `BUILD_SHA`               | `dev`                   | Injected at build time — shown in UI              |

---

## Deploying to Unraid

### Option A — Manual template install

1. Copy `izanagi-unraid.xml` to your Unraid custom templates directory (usually `/boot/config/plugins/community.applications/templates/`).
2. In Unraid → Apps → search "Izanagi" → Install.

### Option B — Use Izanagi to deploy Izanagi

If you already have an Izanagi instance running, you can use its own API to push the template for the next install:

```bash
curl -X POST http://localhost:9731/api/deploy \
  -H "Authorization: Bearer $IZANAGI_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"template_name\":\"izanagi\",\"xml_content\":$(cat izanagi-unraid.xml | jq -Rs .)}"
```

---

## Development

```bash
# Install dependencies
pip install -r requirements.txt -r requirements-dev.txt

# Run tests
pytest tests/ -v --cov=app

# Run locally (no Docker)
IZANAGI_DB_PATH=./data/izanagi.db \
IZANAGI_TEMPLATES_PATH=./templates \
IZANAGI_BOOTSTRAP_TOKEN=dev-secret \
uvicorn app.main:app --reload --port 9731
```

### Project layout

```
app/
  main.py              FastAPI application & lifespan
  models.py            SQLModel table definitions
  auth.py              Bearer token dependency
  db.py                Engine & session factory
  routes/              One file per resource group
  services/            Business logic (templates, tokens, Docker)
  static/              index.html · app.js · style.css
tests/                 pytest suite (fixture-based, in-memory SQLite)
.github/workflows/
  ci.yml               Tests + pip-audit on every push/PR
  release.yml          Build & push to GHCR on v* tags
```

---

## Contributing

1. Fork the repo and create a feature branch.
2. Write tests for any new behaviour.
3. Open a pull request — CI must pass (tests + `pip-audit`).

---

## License

MIT © reloadfast
