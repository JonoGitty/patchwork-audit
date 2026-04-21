const NAV_ITEMS = [
	{ href: "/", label: "Overview", icon: "&#9673;" },
	{ href: "/events", label: "Events", icon: "&#9776;" },
	{ href: "/sessions", label: "Sessions", icon: "&#9201;" },
	{ href: "/risk", label: "Risk", icon: "&#9888;" },
	{ href: "/compliance", label: "Compliance", icon: "&#9878;" },
	{ href: "/search", label: "Search", icon: "&#128269;" },
	{ href: "/doctor", label: "Doctor", icon: "&#9889;" },
	{ href: "/settings", label: "Settings", icon: "&#9881;" },
];

export function layout(title: string, activePath: string, content: string): string {
	const nav = NAV_ITEMS.map(item => {
		const active = item.href === activePath
			|| (item.href !== "/" && activePath.startsWith(item.href));
		return `<a href="${item.href}" class="nav-item${active ? " active" : ""}">${item.icon} ${item.label}</a>`;
	}).join("\n        ");

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — Patchwork</title>
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <style>${CSS}</style>
</head>
<script>
// Health check: poll /api/health every 30 seconds
fetch('/api/health').then(r=>r.json()).then(h=>{
    const dot=document.getElementById('health-dot');
    if(!dot)return;
    if(h.healthy){dot.className='health-dot ok';dot.title='Patchwork healthy';}
    else if(h.hooks.present){dot.className='health-dot warn';dot.title='Hooks present but guard stale';}
    else{dot.className='health-dot fail';dot.title='Hooks missing — run patchwork doctor';}
}).catch(()=>{});
setInterval(()=>{
    fetch('/api/health').then(r=>r.json()).then(h=>{
        const dot=document.getElementById('health-dot');
        if(!dot)return;
        if(h.healthy){dot.className='health-dot ok';dot.title='Patchwork healthy';}
        else if(h.hooks.present){dot.className='health-dot warn';dot.title='Hooks present but guard stale';}
        else{dot.className='health-dot fail';dot.title='Hooks missing — run patchwork doctor';}
    }).catch(()=>{});
},30000);

// Auto-refresh: reload page every 15 seconds to show new events
let _pw_refresh = setInterval(() => {
    // Only refresh if tab is visible and user hasn't scrolled deep
    if (!document.hidden && window.scrollY < 200) {
        fetch(window.location.href, {headers:{"X-Patchwork-Poll":"1"}})
            .then(r => r.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const newMain = doc.querySelector("main");
                if (newMain) document.querySelector("main").innerHTML = newMain.innerHTML;
                // Re-init Chart.js canvases
                document.querySelectorAll("canvas").forEach(c => {
                    const script = c.nextElementSibling;
                    if (script && script.tagName === "SCRIPT") eval(script.textContent);
                });
            })
            .catch(() => {}); // Silently fail if server is down
    }
}, 15000);
</script>
<body>
    <header>
        <div class="header-inner">
            <a href="/" class="logo">&#9641; Patchwork <span id="health-dot" class="health-dot" title="Checking...">&#9679;</span></a>
            <nav>
                ${nav}
            </nav>
        </div>
    </header>
    <main>
        ${content}
    </main>
    <footer>
        <span>Patchwork v0.6.5 — Local audit dashboard</span>
    </footer>
</body>
</html>`;
}

const CSS = `
:root {
    --bg: #0d1117;
    --bg-card: #161b22;
    --bg-hover: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --text-dim: #8b949e;
    --text-muted: #484f58;
    --accent: #58a6ff;
    --critical: #f85149;
    --high: #d29922;
    --medium: #e3b341;
    --low: #8b949e;
    --none: #484f58;
    --green: #3fb950;
    --radius: 8px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    min-height: 100vh;
}

header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 32px;
    height: 56px;
}

.logo {
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
    font-size: 18px;
    white-space: nowrap;
}

nav { display: flex; gap: 4px; overflow-x: auto; }

.nav-item {
    color: var(--text-dim);
    text-decoration: none;
    padding: 8px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text); }
.nav-item.active { color: var(--accent); background: rgba(88,166,255,0.1); }

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
}

footer {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-size: 13px;
    border-top: 1px solid var(--border);
    margin-top: 48px;
}

/* Cards */
.card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
}

.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    text-align: center;
}
.stat-card .value { font-size: 32px; font-weight: 700; color: var(--text); }
.stat-card .label { font-size: 13px; color: var(--text-dim); margin-top: 4px; }

/* Two-column layout */
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
@media (max-width: 768px) { .row { grid-template-columns: 1fr; } }

/* Tables */
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 10px 12px; color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 14px; }
tr:hover td { background: var(--bg-hover); }
tr.clickable { cursor: pointer; }

/* Risk badges */
.risk { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.risk-critical { background: rgba(248,81,73,0.15); color: var(--critical); }
.risk-high { background: rgba(210,153,34,0.15); color: var(--high); }
.risk-medium { background: rgba(227,179,65,0.15); color: var(--medium); }
.risk-low { background: rgba(139,148,158,0.15); color: var(--low); }
.risk-none { background: rgba(72,79,88,0.15); color: var(--none); }

/* Agent badges */
.agent { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; background: rgba(88,166,255,0.1); color: var(--accent); }

/* Action badges */
.action { color: var(--text-dim); font-family: monospace; font-size: 13px; }

/* Status badges */
.status-denied { color: var(--critical); }
.status-completed { color: var(--green); }
.status-failed { color: var(--high); }
.status-pending { color: var(--medium); }

/* Filter bar */
.filter-bar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
}
.filter-bar select, .filter-bar input {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
}
.filter-bar select:focus, .filter-bar input:focus { outline: 1px solid var(--accent); border-color: var(--accent); }

/* Search */
.search-box {
    width: 100%;
    max-width: 600px;
    margin: 0 auto 24px;
    display: block;
    background: var(--bg-card);
    border: 2px solid var(--border);
    color: var(--text);
    padding: 14px 20px;
    border-radius: var(--radius);
    font-size: 16px;
}
.search-box:focus { outline: none; border-color: var(--accent); }

/* Charts */
.chart-container { position: relative; height: 280px; }

/* Timeline */
.timeline { padding-left: 24px; border-left: 2px solid var(--border); }
.timeline-event {
    position: relative;
    padding: 12px 0 12px 24px;
    border-bottom: 1px solid rgba(48,54,61,0.5);
}
.timeline-event::before {
    content: "";
    position: absolute;
    left: -29px;
    top: 16px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
}
.timeline-event.risk-critical::before { background: var(--critical); }
.timeline-event.risk-high::before { background: var(--high); }
.timeline-event.risk-medium::before { background: var(--medium); }

.timeline-time { font-size: 12px; color: var(--text-muted); }
.timeline-action { font-weight: 600; }
.timeline-target { font-family: monospace; font-size: 13px; color: var(--text-dim); word-break: break-all; }

/* Section headings */
h1 { font-size: 24px; margin-bottom: 20px; }
h2 { font-size: 18px; margin-bottom: 16px; color: var(--text); }
h3 { font-size: 15px; margin-bottom: 12px; color: var(--text-dim); }
.subtitle { color: var(--text-dim); font-size: 14px; margin-bottom: 24px; }

/* Empty state */
.empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }

/* Pagination */
.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
.pagination a, .pagination span {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    text-decoration: none;
}
.pagination a { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); }
.pagination a:hover { background: var(--bg-hover); }
.pagination span { color: var(--text-muted); }

/* Detail expansion */
.detail-row { display: none; }
.detail-row.open { display: table-row; }
.detail-content { padding: 16px; background: var(--bg); font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all; }

/* Settings sections */
.settings-section { margin-bottom: 24px; }
.settings-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(48,54,61,0.5); }
.settings-label { color: var(--text-dim); font-size: 14px; }
.settings-value { font-size: 14px; }

/* Health dot */
.health-dot { font-size: 10px; vertical-align: middle; color: var(--text-muted); transition: color 0.3s; }
.health-dot.ok { color: var(--green); }
.health-dot.warn { color: var(--medium); }
.health-dot.fail { color: var(--critical); }

/* Utility */
.mb-16 { margin-bottom: 16px; }
.mb-24 { margin-bottom: 24px; }
.text-center { text-align: center; }
.mono { font-family: monospace; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; display: inline-block; vertical-align: bottom; }
`;
