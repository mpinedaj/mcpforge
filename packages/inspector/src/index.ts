const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>__TITLE__ · MCPForge Inspector</title>
<style>
  :root {
    --bg: #0b0d10;
    --panel: #12151a;
    --panel-2: #171b22;
    --border: #262c36;
    --text: #e6e9ef;
    --muted: #8b94a3;
    --accent: #7c5cff;
    --accent-2: #22d3ee;
    --green: #34d399;
    --yellow: #fbbf24;
    --red: #f87171;
    --radius: 10px;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
  }
  header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #10131a, var(--bg));
    position: sticky; top: 0; z-index: 10;
  }
  .logo {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    display: grid; place-items: center; font-weight: 800; color: #0b0d10;
  }
  header h1 { font-size: 15px; margin: 0; font-weight: 650; }
  header .version { color: var(--muted); font-size: 12px; }
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    border: 1px solid var(--border); background: var(--panel-2); color: var(--muted);
  }
  .badge.lock { color: var(--green); border-color: rgba(52,211,153,.35); }
  .badge.open { color: var(--yellow); border-color: rgba(251,191,36,.35); }
  main { display: grid; grid-template-columns: 320px 1fr; min-height: calc(100vh - 58px); }
  aside { border-right: 1px solid var(--border); background: var(--panel); padding: 14px; }
  .search {
    width: 100%; padding: 9px 11px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); outline: none; margin-bottom: 12px;
  }
  .search:focus { border-color: var(--accent); }
  .tool {
    padding: 10px 11px; border-radius: 8px; cursor: pointer; border: 1px solid transparent;
    display: flex; gap: 9px; align-items: flex-start; margin-bottom: 4px;
  }
  .tool:hover { background: var(--panel-2); }
  .tool.active { background: var(--panel-2); border-color: var(--border); }
  .method {
    font-family: var(--mono); font-size: 9px; font-weight: 700; padding: 3px 5px;
    border-radius: 4px; letter-spacing: .4px; flex: none; margin-top: 1px;
  }
  .m-GET { background: rgba(52,211,153,.14); color: var(--green); }
  .m-POST { background: rgba(124,92,255,.18); color: #a78bfa; }
  .m-PUT, .m-PATCH { background: rgba(251,191,36,.14); color: var(--yellow); }
  .m-DELETE { background: rgba(248,113,113,.14); color: var(--red); }
  .m-HEAD, .m-OPTIONS { background: rgba(139,148,163,.14); color: var(--muted); }
  .tool .name { font-family: var(--mono); font-size: 12px; word-break: break-all; }
  .tool .path { color: var(--muted); font-size: 11px; margin-top: 3px; word-break: break-all; }
  section { padding: 24px 28px; overflow: auto; }
  .empty { color: var(--muted); text-align: center; margin-top: 20vh; }
  .empty h2 { color: var(--text); font-weight: 600; }
  .tool-head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .tool-head h2 { margin: 0; font-family: var(--mono); font-size: 19px; font-weight: 600; }
  .route { font-family: var(--mono); color: var(--accent-2); font-size: 12px; margin-top: 8px; }
  .desc { color: var(--muted); margin: 14px 0 20px; white-space: pre-wrap; line-height: 1.55; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } main { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--border); } }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .card h3 {
    margin: 0; padding: 10px 14px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .8px; color: var(--muted); border-bottom: 1px solid var(--border);
    background: var(--panel-2); font-weight: 650;
  }
  pre {
    margin: 0; padding: 14px; font-family: var(--mono); font-size: 12px; line-height: 1.55;
    overflow: auto; max-height: 340px; white-space: pre-wrap; word-break: break-word;
  }
  textarea {
    width: 100%; min-height: 190px; resize: vertical; border: 0; outline: none;
    background: var(--bg); color: var(--text); padding: 14px;
    font-family: var(--mono); font-size: 12px; line-height: 1.55;
  }
  .actions { display: flex; gap: 10px; align-items: center; margin-top: 16px; }
  button {
    border: 0; border-radius: 8px; padding: 9px 16px; font-weight: 650; cursor: pointer;
    background: linear-gradient(135deg, var(--accent), #5b8cff); color: white;
  }
  button:disabled { opacity: .55; cursor: not-allowed; }
  button.ghost { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
  .status { font-size: 12px; color: var(--muted); font-family: var(--mono); }
  .status.ok { color: var(--green); }
  .status.err { color: var(--red); }
  .pill { font-size: 11px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px; }
  .hint { color: var(--muted); font-size: 12px; margin-top: 8px; }
  a { color: var(--accent-2); }
</style>
</head>
<body>
<header>
  <div class="logo">M</div>
  <div>
    <h1>__TITLE__</h1>
    <div class="version">MCPForge Inspector · v__VERSION__</div>
  </div>
  <div style="flex:1"></div>
  <span id="securityBadge" class="badge">loading…</span>
  <span id="toolCount" class="badge">0 tools</span>
</header>
<main>
  <aside>
    <input id="search" class="search" placeholder="Filter tools…" autocomplete="off" />
    <div id="toolList"></div>
  </aside>
  <section id="detail">
    <div class="empty">
      <h2>Select a tool</h2>
      <p>Inspect its schema and call it against the upstream API.</p>
    </div>
  </section>
</main>
<script>
  var state = { manifest: null, tools: [], selected: null, security: null, query: "" };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function methodClass(method) {
    return "m-" + String(method || "GET").toUpperCase();
  }

  function exampleFor(schema) {
    if (!schema || typeof schema !== "object") return "string";
    if (schema.default !== undefined) return schema.default;
    if (schema.enum && schema.enum.length) return schema.enum[0];
    var type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (type === "integer" || type === "number") return 0;
    if (type === "boolean") return false;
    if (type === "array") return [];
    if (type === "object") {
      var obj = {};
      var props = schema.properties || {};
      var required = schema.required || [];
      Object.keys(props).forEach(function (key) {
        if (required.length === 0 || required.indexOf(key) !== -1) obj[key] = exampleFor(props[key]);
      });
      return obj;
    }
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "date") return new Date().toISOString().slice(0, 10);
    return "string";
  }

  function buildExample(tool) {
    var schema = tool.inputSchema || {};
    var props = schema.properties || {};
    var required = schema.required || [];
    var args = {};
    Object.keys(props).forEach(function (key) {
      if (required.length === 0 || required.indexOf(key) !== -1) args[key] = exampleFor(props[key]);
    });
    return JSON.stringify(args, null, 2);
  }

  function renderList() {
    var list = document.getElementById("toolList");
    var query = state.query.toLowerCase();
    var tools = state.tools.filter(function (tool) {
      return !query || tool.name.toLowerCase().indexOf(query) !== -1 || tool.path.toLowerCase().indexOf(query) !== -1;
    });
    if (tools.length === 0) {
      list.innerHTML = '<div class="hint">No tools match.</div>';
      return;
    }
    list.innerHTML = tools.map(function (tool) {
      var active = state.selected && state.selected.name === tool.name ? " active" : "";
      return '<div class="tool' + active + '" data-name="' + esc(tool.name) + '">' +
        '<span class="method ' + methodClass(tool.method) + '">' + esc(tool.method) + '</span>' +
        '<div><div class="name">' + esc(tool.name) + '</div><div class="path">' + esc(tool.path) + '</div></div>' +
        '</div>';
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".tool"), function (el) {
      el.addEventListener("click", function () { selectTool(el.getAttribute("data-name")); });
    });
  }

  function selectTool(name) {
    state.selected = state.tools.find(function (tool) { return tool.name === name; }) || null;
    renderList();
    renderDetail();
  }

  function renderDetail() {
    var detail = document.getElementById("detail");
    var tool = state.selected;
    if (!tool) {
      detail.innerHTML = '<div class="empty"><h2>Select a tool</h2><p>Inspect its schema and call it against the upstream API.</p></div>';
      return;
    }
    var schema = JSON.stringify(tool.inputSchema || {}, null, 2);
    var route = tool.method + " " + tool.path;
    detail.innerHTML =
      '<div class="tool-head"><span class="method ' + methodClass(tool.method) + '">' + esc(tool.method) + '</span>' +
      '<h2>' + esc(tool.name) + '</h2>' +
      '<span class="pill">' + (tool.readOnly ? "read-only" : "write") + '</span>' +
      (tool.tags && tool.tags.length ? '<span class="pill">' + esc(tool.tags.join(", ")) + '</span>' : "") +
      '</div>' +
      '<div class="route">' + esc(route) + '</div>' +
      '<div class="desc">' + esc(tool.description) + '</div>' +
      '<div class="grid">' +
        '<div class="card"><h3>Input schema</h3><pre>' + esc(schema) + '</pre></div>' +
        '<div class="card"><h3>Arguments (JSON)</h3><textarea id="args"></textarea></div>' +
      '</div>' +
      '<div class="actions">' +
        '<button id="callBtn">Call tool</button>' +
        '<button id="resetBtn" class="ghost">Reset example</button>' +
        '<span id="callStatus" class="status"></span>' +
      '</div>' +
      '<div class="hint">Requests are executed by the local MCPForge runtime using the configured base URL and credentials.</div>' +
      '<div class="card" style="margin-top:16px"><h3>Response</h3><pre id="response">—</pre></div>';
    var args = document.getElementById("args");
    args.value = buildExample(tool);
    document.getElementById("resetBtn").addEventListener("click", function () { args.value = buildExample(tool); });
    document.getElementById("callBtn").addEventListener("click", callSelected);
  }

  function callSelected() {
    var tool = state.selected;
    if (!tool) return;
    var status = document.getElementById("callStatus");
    var response = document.getElementById("response");
    var button = document.getElementById("callBtn");
    var args;
    try {
      args = JSON.parse(document.getElementById("args").value || "{}");
    } catch (error) {
      status.className = "status err";
      status.textContent = "Invalid JSON: " + error.message;
      return;
    }
    button.disabled = true;
    status.className = "status";
    status.textContent = "Calling…";
    response.textContent = "—";
    fetch("/api/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: tool.name, arguments: args })
    })
      .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
      .then(function (payload) {
        var result = payload.body.result;
        if (payload.body.error) {
          status.className = "status err";
          status.textContent = payload.body.error;
          response.textContent = JSON.stringify(payload.body, null, 2);
          return;
        }
        status.className = "status " + (result && result.ok ? "ok" : "err");
        status.textContent = (result ? result.status : "?") + " · " + (result ? result.durationMs : "?") + "ms";
        response.textContent = JSON.stringify(result ? result.body : payload.body, null, 2);
      })
      .catch(function (error) {
        status.className = "status err";
        status.textContent = error.message;
      })
      .then(function () { button.disabled = false; });
  }

  function boot() {
    fetch("/api/manifest")
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        state.manifest = payload.manifest;
        state.tools = (payload.manifest && payload.manifest.tools) || [];
        state.security = payload.security || {};
        document.getElementById("toolCount").textContent = state.tools.length + " tools";
        var badge = document.getElementById("securityBadge");
        if (state.security.readOnly) {
          badge.className = "badge lock";
          badge.textContent = "read-only mode";
        } else {
          badge.className = "badge open";
          badge.textContent = "write access enabled";
        }
        renderList();
      })
      .catch(function (error) {
        document.getElementById("toolList").innerHTML = '<div class="hint">Failed to load manifest: ' + esc(error.message) + '</div>';
      });
    document.getElementById("search").addEventListener("input", function (event) {
      state.query = event.target.value;
      renderList();
    });
  }

  boot();
</script>
</body>
</html>`;

export interface InspectorOptions {
  title?: string;
  version?: string;
}

export function renderInspectorHtml(options: InspectorOptions = {}): string {
  const title = escapeHtml(options.title ?? "MCPForge");
  const version = escapeHtml(options.version ?? "0.1.0");
  return HTML.replaceAll("__TITLE__", title).replaceAll("__VERSION__", version);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
