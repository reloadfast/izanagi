/* ─── Izanagi UI ────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initVersionBadge();
  initDeploy();
  initTokenModal();
  initSettings();
  initNoTokenBanner();

  document.getElementById("refresh-history").addEventListener("click", loadHistory);
  document.getElementById("new-token-btn").addEventListener("click", openTokenModal);

  // First-run: no token → land on Settings instead of Deploy
  const hasToken = !!localStorage.getItem("izanagi-token");
  switchTab(hasToken ? "deploy" : "settings");
  loadVersionBadge();
});

/* ─── Theme ─────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem("izanagi-theme") || "dark";
  applyTheme(saved);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("izanagi-theme", theme);
  document.getElementById("theme-icon").textContent = theme === "dark" ? "☀" : "☾";
}

/* ─── Tabs ──────────────────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  document.querySelectorAll(".tab-content").forEach((s) =>
    s.classList.toggle("active", s.id === `tab-${name}`)
  );

  if (name === "history") { loadHistory(); startHistoryRefresh(); }
  else stopHistoryRefresh();
  if (name === "tokens") loadTokens();
  if (name === "settings") loadSettings();
  if (name === "docs") loadDocs();
}

/* ─── Version badge ─────────────────────────────────────────────── */
let _versionData = null;

async function loadVersionBadge() {
  try {
    _versionData = await apiFetch("/api/version", { noAuth: true });
    const badge = document.getElementById("version-badge");
    badge.textContent = _versionData.build_sha || _versionData.version;
    badge.title = `v${_versionData.version} · ${_versionData.build_sha} — click to copy`;
  } catch (_) {
    // Non-fatal
  }
}

function initVersionBadge() {
  const badge = document.getElementById("version-badge");
  badge.addEventListener("click", () => {
    const payload = _versionData
      ? `${_versionData.name} v${_versionData.version} (${_versionData.build_sha})`
      : badge.textContent;

    navigator.clipboard
      .writeText(payload)
      .then(() => {
        const original = badge.textContent;
        badge.textContent = "Copied!";
        setTimeout(() => {
          badge.textContent = _versionData
            ? _versionData.build_sha || _versionData.version
            : original;
        }, 1500);
      })
      .catch(() => {});
  });
}

/* ─── API helper ────────────────────────────────────────────────── */
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("izanagi-token");
  const headers = { "Content-Type": "application/json", ...options.headers };

  if (!options.noAuth) {
    if (!token) throw new Error("No API token set — go to Settings to add one.");
    headers["Authorization"] = `Bearer ${token}`;
  }

  const resp = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ?? undefined,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

/* ─── Deploy ────────────────────────────────────────────────────── */
function initDeploy() {
  const fileBtn   = document.getElementById("file-btn");
  const fileInput = document.getElementById("file-input");
  const dropArea  = document.getElementById("drop-area");

  fileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) readXmlFile(e.target.files[0]);
  });

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("drag-over");
  });
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".xml")) readXmlFile(f);
  });

  document.getElementById("deploy-btn").addEventListener("click", runDeploy);
}

function readXmlFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("xml-content").value = e.target.result;
  };
  reader.readAsText(file);

  const nameInput = document.getElementById("template-name");
  if (!nameInput.value) nameInput.value = file.name.replace(/\.xml$/i, "");
}

async function runDeploy() {
  const templateName  = document.getElementById("template-name").value.trim();
  const xmlContent    = document.getElementById("xml-content").value.trim();
  const containerName = document.getElementById("container-name").value.trim();
  const feedback      = document.getElementById("deploy-feedback");
  const btn           = document.getElementById("deploy-btn");

  if (!templateName || !xmlContent) {
    showFeedback(feedback, "error", "Template name and XML content are required.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Deploying…";

  try {
    const result = await apiFetch("/api/deploy", {
      method: "POST",
      body: JSON.stringify({ template_name: templateName, xml_content: xmlContent }),
    });

    let msg = `Template <strong>${esc(templateName)}</strong> ${result.action} successfully.`;

    if (containerName) {
      try {
        const restart = await apiFetch(
          `/api/restart/${encodeURIComponent(containerName)}`,
          { method: "POST" }
        );

        if (restart.status === "restarted") {
          msg += ` Container <strong>${esc(containerName)}</strong> restarted.`;
          showFeedback(feedback, "success", msg);
        } else if (restart.status === "manual_recreate_required") {
          showFeedback(
            feedback,
            "warning",
            `${msg}<br><br>` +
              `<strong>Manual action required:</strong> Container ` +
              `<strong>${esc(containerName)}</strong> must be recreated. ` +
              `<a href="http://tower.local/Docker" target="_blank" rel="noopener noreferrer">` +
              `Open Unraid Docker page →</a>`
          );
        }
      } catch (restartErr) {
        showFeedback(feedback, "warning", `${msg}<br>Restart skipped: ${esc(restartErr.message)}`);
      }
    } else {
      showFeedback(feedback, "success", msg);
    }
  } catch (err) {
    showFeedback(feedback, "error", `Deploy failed: ${esc(err.message)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Deploy";
  }
}

function showFeedback(el, type, html) {
  el.className = `feedback feedback-${type}`;
  el.innerHTML = html;
  el.classList.remove("hidden");
}

/* ─── History ───────────────────────────────────────────────────── */
let _historyData  = [];
let _historyTimer = null;

function renderHistoryRows() {
  const tbody = document.getElementById("history-body");
  const empty = document.getElementById("history-empty");

  if (!_historyData.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  tbody.innerHTML = "";
  _historyData.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td title="${esc(formatDate(row.timestamp))}" style="cursor:default">${esc(relativeTime(row.timestamp))}</td>
      <td><code>${esc(row.template_name)}</code></td>
      <td>${esc(row.agent_name)}</td>
      <td><span class="badge badge-${row.action}">${esc(row.action)}</span></td>
      <td><span class="badge badge-${row.outcome}">${esc(row.outcome)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadHistory() {
  const tbody = document.getElementById("history-body");
  const empty = document.getElementById("history-empty");

  tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading…</td></tr>`;
  empty.classList.add("hidden");

  try {
    _historyData = await apiFetch("/api/history");
    renderHistoryRows();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error">${esc(err.message)}</td></tr>`;
  }
}

function startHistoryRefresh() {
  stopHistoryRefresh();
  _historyTimer = setInterval(() => renderHistoryRows(), 60_000);
}

function stopHistoryRefresh() {
  if (_historyTimer) { clearInterval(_historyTimer); _historyTimer = null; }
}

/* ─── Tokens ────────────────────────────────────────────────────── */
async function loadTokens() {
  const tbody = document.getElementById("tokens-body");
  const empty = document.getElementById("tokens-empty");

  tbody.innerHTML = `<tr><td colspan="4" class="loading">Loading…</td></tr>`;
  empty.classList.add("hidden");

  try {
    const data = await apiFetch("/api/tokens");
    tbody.innerHTML = "";

    if (!data.length) {
      empty.classList.remove("hidden");
      return;
    }

    data.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(t.agent_name)}</td>
        <td>${esc(formatDate(t.created_at))}</td>
        <td>${t.last_used_at ? esc(formatDate(t.last_used_at)) : '<span class="text-muted">Never</span>'}</td>
        <td>
          <button
            class="btn btn-danger btn-sm"
            onclick="revokeToken(${t.id}, ${JSON.stringify(t.agent_name)})"
          >Revoke</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="error">${esc(err.message)}</td></tr>`;
  }
}

async function revokeToken(id, name) {
  if (!confirm(`Revoke token for "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/tokens/${id}`, { method: "DELETE" });
    loadTokens();
  } catch (err) {
    alert(`Failed to revoke: ${err.message}`);
  }
}

/* ─── Token modal ───────────────────────────────────────────────── */
function initTokenModal() {
  document.getElementById("modal-close").addEventListener("click", closeTokenModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeTokenModal();
  });
  document.getElementById("generate-token-btn").addEventListener("click", generateToken);
  document.getElementById("copy-token-btn").addEventListener("click", copyGeneratedToken);
  document.getElementById("modal-done-btn").addEventListener("click", () => {
    closeTokenModal();
    loadTokens();
  });

  document.getElementById("new-agent-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateToken();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTokenModal();
  });
}

function openTokenModal() {
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("modal-create").classList.remove("hidden");
  document.getElementById("modal-result").classList.add("hidden");
  document.getElementById("new-agent-name").value = "";
  const errEl = document.getElementById("modal-inline-error");
  if (errEl) errEl.textContent = "";
  setTimeout(() => document.getElementById("new-agent-name").focus(), 50);
}

function closeTokenModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

async function generateToken() {
  const agentName = document.getElementById("new-agent-name").value.trim();
  if (!agentName) {
    document.getElementById("new-agent-name").focus();
    return;
  }

  const btn = document.getElementById("generate-token-btn");
  btn.disabled = true;
  btn.textContent = "Generating…";

  try {
    const result = await apiFetch("/api/tokens", {
      method: "POST",
      body: JSON.stringify({ agent_name: agentName }),
    });

    document.getElementById("generated-token").textContent = result.token;
    document.getElementById("modal-create").classList.add("hidden");
    document.getElementById("modal-result").classList.remove("hidden");

    // Cache raw token in sessionStorage so Docs tab can use it this session
    const sessionTokens = JSON.parse(sessionStorage.getItem("izanagi-session-tokens") || "[]");
    sessionTokens.push({ id: result.id, agent_name: result.agent_name, token: result.token });
    sessionStorage.setItem("izanagi-session-tokens", JSON.stringify(sessionTokens));
  } catch (err) {
    let msg = err.message;
    if (msg.includes("No API token set")) {
      msg = "No API token configured. Go to Settings and paste your bootstrap token first.";
    }
    let errEl = document.getElementById("modal-inline-error");
    if (!errEl) {
      errEl = document.createElement("p");
      errEl.id = "modal-inline-error";
      errEl.style.cssText = "color:var(--error);font-size:.85rem;margin-top:10px";
      document.getElementById("modal-create").appendChild(errEl);
    }
    errEl.textContent = msg;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate Token";
  }
}

function copyGeneratedToken() {
  const token = document.getElementById("generated-token").textContent;
  navigator.clipboard.writeText(token).then(() => {
    const btn = document.getElementById("copy-token-btn");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}

/* ─── No-token banner ───────────────────────────────────────────── */
function initNoTokenBanner() {
  document.getElementById("banner-go-settings").addEventListener("click", () => {
    switchTab("settings");
  });
}

function updateBanner() {
  const banner = document.getElementById("no-token-banner");
  const hasToken = !!localStorage.getItem("izanagi-token");
  banner.classList.toggle("hidden", hasToken);
}

/* ─── Settings ──────────────────────────────────────────────────── */
function initSettings() {
  const input = document.getElementById("api-token-input");
  input.value = localStorage.getItem("izanagi-token") || "";

  document.getElementById("save-token-btn").addEventListener("click", async () => {
    const val = input.value.trim();
    localStorage.setItem("izanagi-token", val);
    updateBanner();
    loadDocs(); // keep Docs prompt in sync immediately

    const btn = document.getElementById("save-token-btn");
    btn.textContent = "Saved!";
    setTimeout(() => (btn.textContent = "Save"), 1500);

    await validateToken();
  });

  document.getElementById("test-token-btn").addEventListener("click", validateToken);

  document.getElementById("reveal-token-btn").addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    document.getElementById("reveal-token-btn").textContent = isHidden ? "🙈" : "👁";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save-token-btn").click();
  });
}

async function validateToken() {
  const statusEl = document.getElementById("token-status");
  const testBtn  = document.getElementById("test-token-btn");

  if (!localStorage.getItem("izanagi-token")) {
    statusEl.className = "token-status-err";
    statusEl.textContent = "✗ No token set";
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = "Testing…";

  try {
    const data = await apiFetch("/api/me");
    statusEl.className = "token-status-ok";
    statusEl.textContent = `✓ Valid — authenticated as ${data.agent_name}`;
  } catch (e) {
    statusEl.className = "token-status-err";
    statusEl.textContent = `✗ ${e.message}`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test";
  }
}

async function loadSettings() {
  updateBanner();
  const input = document.getElementById("api-token-input");
  input.value = localStorage.getItem("izanagi-token") || "";
  input.type = "password";
  document.getElementById("reveal-token-btn").textContent = "👁";
  validateToken();
  const display = document.getElementById("config-display");
  try {
    const data = await apiFetch("/api/version", { noAuth: true });
    display.innerHTML = `
      <div class="config-table">
        <div class="config-row">
          <span class="config-key">App Name</span>
          <span class="config-val">${esc(data.name)}</span>
        </div>
        <div class="config-row">
          <span class="config-key">Version</span>
          <span class="config-val">${esc(data.version)}</span>
        </div>
        <div class="config-row">
          <span class="config-key">Build SHA</span>
          <span class="config-val"><code>${esc(data.build_sha)}</code></span>
        </div>
      </div>
      <p class="hint">
        Server configuration (templates path, DB path, Docker socket) is set via
        environment variables — see the README for the full list.
      </p>
    `;
  } catch (_) {
    display.innerHTML = `<p class="hint">Could not load server info.</p>`;
  }
}

/* ─── Docs ──────────────────────────────────────────────────────── */
async function loadDocs() {
  const base = window.location.origin;

  // Use onclick to avoid stacking listeners on repeated tab visits
  document.getElementById("copy-agent-prompt-btn").onclick = copyAgentPrompt;

  const select  = document.getElementById("prompt-token-select");
  const hint    = document.getElementById("prompt-token-hint");
  const pre     = document.getElementById("agent-prompt");

  // Populate token dropdown
  try {
    const tokens = await apiFetch("/api/tokens");
    const sessionTokens = JSON.parse(sessionStorage.getItem("izanagi-session-tokens") || "[]");
    const sessionMap = Object.fromEntries(sessionTokens.map((t) => [String(t.id), t.token]));

    // Rebuild options (preserve selection if possible)
    const currentVal = select.value;
    select.innerHTML = `<option value="">— select a token —</option>`;
    tokens.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.agent_name;
      opt.dataset.agentName = t.agent_name;
      opt.dataset.hasRaw = sessionMap[t.id] ? "1" : "0";
      select.appendChild(opt);
    });
    // Restore previous selection
    if (currentVal) select.value = currentVal;
  } catch (_) {
    // Non-fatal — leave dropdown with just the placeholder
  }

  renderAgentPrompt(base);

  select.onchange = () => renderAgentPrompt(base);
}

function renderAgentPrompt(base) {
  const select  = document.getElementById("prompt-token-select");
  const hint    = document.getElementById("prompt-token-hint");
  const pre     = document.getElementById("agent-prompt");

  const selectedOpt = select.options[select.selectedIndex];
  const tokenId     = select.value;

  if (!tokenId) {
    // No token selected — fall back to the browser's saved token or a generic placeholder
    const saved = localStorage.getItem("izanagi-token") || "<YOUR_IZANAGI_TOKEN>";
    pre.textContent = buildAgentPrompt(base, saved);
    hint.textContent = "";
    return;
  }

  const agentName   = selectedOpt.dataset.agentName || selectedOpt.textContent;
  const sessionTokens = JSON.parse(sessionStorage.getItem("izanagi-session-tokens") || "[]");
  const sessionMap  = Object.fromEntries(sessionTokens.map((t) => [String(t.id), t.token]));
  const rawToken    = sessionMap[tokenId];

  if (rawToken) {
    pre.textContent = buildAgentPrompt(base, rawToken);
    hint.textContent = "";
  } else {
    // Token exists but was created in a previous session — use a named placeholder
    const placeholder = `<TOKEN_FOR_${agentName.toUpperCase().replace(/\s+/g, "_")}>`;
    pre.textContent = buildAgentPrompt(base, placeholder);
    hint.textContent = "Token value not available — it was shown only once at creation. Replace the placeholder with the actual token value.";
  }
}

function copyAgentPrompt() {
  const text = document.getElementById("agent-prompt").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copy-agent-prompt-btn");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = orig), 1500);
  });
}

function buildAgentPrompt(base, token) {
  return `\
You have access to Izanagi, a self-hosted Unraid template deployment service.
Use it to deploy Unraid Community Applications XML templates and restart containers.

## Connection

Base URL : ${base}
Auth     : Bearer token — include the header below in every request
           Authorization: Bearer ${token}

## Deploy a template

POST ${base}/api/deploy
Content-Type: application/json
Authorization: Bearer ${token}

{
  "template_name": "<name-without-extension>",
  "xml_content": "<Container>...</Container>"
}

Responses:
  { "status": "ok", "action": "created", "template_name": "..." }  — new template
  { "status": "ok", "action": "updated", "template_name": "..." }  — overwrote existing

Rules:
- template_name must be alphanumeric with dashes or underscores only.
- Deploying an existing name overwrites the file and records a new history entry.
- Always validate the XML is a well-formed Unraid template before deploying.

## Restart a container after deploy

POST ${base}/api/restart/<container_name>
Authorization: Bearer ${token}

Responses:
  { "status": "restarted",               "container_name": "..." }  — success
  { "status": "manual_recreate_required","container_name": "...", "reason": "..." }  — needs user action

If you receive manual_recreate_required, inform the user that the container must be
stopped and recreated manually in the Unraid Docker UI — a simple restart is not enough.

## Check deploy history

GET ${base}/api/history
Authorization: Bearer ${token}

Returns an array of recent deploys: timestamp, template_name, agent_name, action, outcome.

## Recommended workflow

1. Obtain or generate the Unraid XML template for the application.
2. POST to /api/deploy with the template name and XML content.
3. If the user wants the container updated immediately, POST to /api/restart/<name>.
4. If restart returns manual_recreate_required, tell the user to recreate the container
   in Unraid and provide the reason.
5. Confirm success by checking the response or querying /api/history.

## What NOT to do

- Do not deploy templates that are not valid Unraid Community Applications XML.
- Do not include file extensions in template_name (the service adds .xml automatically).
- Do not retry a failed deploy without understanding the error first.
- Do not expose the bearer token in logs, comments, or committed code.`;
}

/* ─── Utilities ─────────────────────────────────────────────────── */
function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)                        return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)                        return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)                        return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1)                       return "yesterday";
  if (d < 30)                        return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)                       return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}
