/* ─── Izanagi UI ────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initVersionBadge();
  initDeploy();
  initTokenModal();
  initSettings();

  document.getElementById("refresh-history").addEventListener("click", loadHistory);
  document.getElementById("new-token-btn").addEventListener("click", openTokenModal);

  switchTab("deploy");
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

  if (name === "history") loadHistory();
  if (name === "tokens") loadTokens();
  if (name === "settings") loadSettings();
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
async function loadHistory() {
  const tbody = document.getElementById("history-body");
  const empty = document.getElementById("history-empty");

  tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading…</td></tr>`;
  empty.classList.add("hidden");

  try {
    const data = await apiFetch("/api/history");
    tbody.innerHTML = "";

    if (!data.length) {
      empty.classList.remove("hidden");
      return;
    }

    data.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(formatDate(row.timestamp))}</td>
        <td><code>${esc(row.template_name)}</code></td>
        <td>${esc(row.agent_name)}</td>
        <td><span class="badge badge-${row.action}">${esc(row.action)}</span></td>
        <td><span class="badge badge-${row.outcome}">${esc(row.outcome)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error">${esc(err.message)}</td></tr>`;
  }
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
  } catch (err) {
    alert(`Failed to create token: ${err.message}`);
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

/* ─── Settings ──────────────────────────────────────────────────── */
function initSettings() {
  const input = document.getElementById("api-token-input");
  input.value = localStorage.getItem("izanagi-token") || "";

  document.getElementById("save-token-btn").addEventListener("click", () => {
    localStorage.setItem("izanagi-token", input.value.trim());
    const btn = document.getElementById("save-token-btn");
    const orig = btn.textContent;
    btn.textContent = "Saved!";
    setTimeout(() => (btn.textContent = orig), 1500);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save-token-btn").click();
  });
}

async function loadSettings() {
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

function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}
