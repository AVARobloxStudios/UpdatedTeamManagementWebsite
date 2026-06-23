import { loadCloudState, saveCloudState } from "./firebase.js";
const STORAGE_KEY = "ava-studios-team-workflow-v1";

const BASE_PHASES = [
  {
    id: "phase-1",
    number: 1,
    title: "Game Idea Generation + Market Research",
    description: "Define the game promise, audience, reference titles, monetization angle, and feasibility notes.",
    roles: "Creative Lead, Producer",
    dependencies: "",
    progress: 0,
  },
  {
    id: "phase-2",
    number: 2,
    title: "Base Code + Base UI, Maps, Assets",
    description: "Create the foundation: project structure, reusable systems, first map pass, interface kit, and core asset list.",
    roles: "Scripter, Builder, UI",
    dependencies: "Phase 1",
    progress: 0,
  },
  {
    id: "phase-3",
    number: 3,
    title: "Core Gameplay Features + Integration",
    description: "Build the main loop, player progression, economy, rewards, and connect systems into a playable slice.",
    roles: "Scripter, Builder",
    dependencies: "Phase 2",
    progress: 0,
  },
  {
    id: "phase-4",
    number: 4,
    title: "Testing, Debugging + Balancing",
    description: "Run private tests, track issues, tune pacing, validate difficulty, and remove launch blockers.",
    roles: "QA, Producer",
    dependencies: "Phase 3",
    progress: 0,
  },
  {
    id: "phase-5",
    number: 5,
    title: "Launch Prep + Community Materials",
    description: "Prepare thumbnails, trailers, game page copy, social posts, creator assets, and release notes.",
    roles: "Designer, Community",
    dependencies: "Phase 4",
    progress: 0,
  },
  {
    id: "phase-6",
    number: 6,
    title: "Launch + Updates",
    description: "Publish, monitor feedback, triage bugs, and plan live content updates after release.",
    roles: "Producer, Scripter",
    dependencies: "Phase 5",
    progress: 0,
  },
];

const pageMeta = {
  workflow: ["Workflow", "Shape the Roblox production pipeline from concept to launch."],
  dashboard: ["Dashboard", "Track tasks, focus areas, upcoming dates, and completion."],
  calendar: ["Calendar", "Plan studio events, deadlines, purchase dates, and launch work."],
  purchasing: ["Purchasing", "Manage expenses, payment status, and shared cost responsibility."],
  files: ["Files", "Collect videos, images, and documents by role for quick team access."],
  settings: ["Settings", "Tune display preferences, team members, and project data."],
};

const navItems = [
  ["workflow", "workflow", "Workflow"],
  ["dashboard", "dashboard", "Dashboard"],
  ["calendar", "calendar", "Calendar"],
  ["purchasing", "purchasing", "Purchasing"],
  ["files", "files", "Files"],
  ["settings", "settings", "Settings"],
];

let state = loadState();
let page = "workflow";
let modal = null;
let filters = { taskStatus: "all", taskPhase: "all", taskRole: "all", calendarView: "month", fileRole: "all" };
let calendarDate = new Date();
let selectedTasks = new Set();
let workflowView = { zoom: 0.72, focusId: null };

function freshState() {
  return {
    theme: "light",
    scale: 1,
    logo: "./assets/ava-logo.png",
    phases: structuredClone(BASE_PHASES),
    roles: defaultRoles(),
    members: [],
    tasks: [],
    events: [],
    purchases: [],
    attachments: [],
    projectFiles: [],
    fileTabs: defaultFileTabs(),
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return freshState();
    const hydrated = { ...freshState(), ...saved, phases: saved.phases?.length ? saved.phases : structuredClone(BASE_PHASES) };
    migrateState(hydrated);
    return hydrated;
  } catch {
    return freshState();
  }
}

function defaultRoles() {
  return [
    { id: "role-producer", name: "Producer", description: "Coordinates priorities, deadlines, scope, and team handoffs." },
    { id: "role-scripter", name: "Scripter", description: "Builds gameplay systems, tools, UI logic, and technical integrations." },
    { id: "role-builder", name: "Builder", description: "Creates maps, props, environments, and Roblox Studio assets." },
  ];
}

function defaultFileTabs() {
  return [
    { id: "tab-producer", name: "Producer", roleId: "role-producer" },
    { id: "tab-scripter", name: "Scripter", roleId: "role-scripter" },
    { id: "tab-builder", name: "Builder", roleId: "role-builder" },
    { id: "tab-other", name: "Other", roleId: "" },
  ];
}

function slug(value = "item") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function normalizeRoles(roles = [], sourceNames = []) {
  const base = roles.length ? roles : defaultRoles();
  const map = new Map();
  [...defaultRoles(), ...base].forEach((role) => {
    const name = typeof role === "string" ? role : role.name;
    if (!name) return;
    const id = typeof role === "object" && role.id ? role.id : `role-${slug(name)}`;
    const description = typeof role === "object" ? role.description || "" : "";
    map.set(id, { id, name, description });
  });
  sourceNames.forEach((name) => {
    if (!name) return;
    const clean = name === "UI Designer" ? "Other" : name;
    if (clean === "Other" || [...map.values()].some((role) => role.name.toLowerCase() === clean.toLowerCase())) return;
    map.set(`role-${slug(clean)}`, { id: `role-${slug(clean)}`, name: clean, description: "" });
  });
  return [...map.values()];
}

function findRoleIdByName(name = "", roles = state.roles) {
  const clean = name === "UI Designer" ? "Other" : name;
  return roles.find((role) => role.name.toLowerCase() === clean.toLowerCase())?.id || "";
}

function normalizeFileTabs(tabs = [], roles = state.roles) {
  const base = tabs.length ? tabs : defaultFileTabs();
  const seen = new Set();
  const normalized = base.map((tab) => {
    const name = typeof tab === "string" ? tab : tab.name;
    const clean = name === "UI Designer" ? "Other" : name;
    const id = typeof tab === "object" && tab.id ? tab.id : `tab-${slug(clean)}`;
    const roleId = typeof tab === "object" ? tab.roleId || findRoleIdByName(tab.role || tab.name || "", roles) : findRoleIdByName(clean, roles);
    return { id, name: clean || "Untitled", roleId: clean === "Other" ? "" : roleId };
  }).filter((tab) => {
    if (seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
  if (!normalized.some((tab) => tab.name === "Other")) normalized.push({ id: "tab-other", name: "Other", roleId: "" });
  return normalized;
}

function migrateState(hydrated) {
  const legacyRoleNames = [
    ...(hydrated.members || []).map((member) => member.role),
    ...(hydrated.tasks || []).map((task) => task.role),
    ...(hydrated.projectFiles || []).map((file) => file.role),
    ...(hydrated.fileTabs || []).map((tab) => (typeof tab === "string" ? tab : tab.role || tab.name)),
  ].filter(Boolean);
  hydrated.roles = normalizeRoles(hydrated.roles, legacyRoleNames);
  hydrated.fileTabs = normalizeFileTabs(hydrated.fileTabs, hydrated.roles);
  hydrated.members = (hydrated.members || []).map((member) => ({ ...member, roleId: member.roleId || findRoleIdByName(member.role || "", hydrated.roles) }));
  hydrated.tasks = (hydrated.tasks || []).map((task) => ({ ...task, roleId: task.roleId || findRoleIdByName(task.role || "", hydrated.roles) }));
  hydrated.projectFiles = (hydrated.projectFiles || []).map((file) => {
    const tabId = file.tabId || hydrated.fileTabs.find((tab) => tab.name === file.role)?.id || "";
    return { ...file, tabId, roleId: file.roleId || hydrated.fileTabs.find((tab) => tab.id === tabId)?.roleId || findRoleIdByName(file.role || "", hydrated.roles) };
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fileSize(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function getPhase(id) {
  return state.phases.find((phase) => phase.id === id);
}

function getMember(id) {
  return state.members.find((member) => member.id === id);
}

function getRole(id) {
  return state.roles.find((role) => role.id === id);
}

function roleName(roleId = "") {
  return getRole(roleId)?.name || "No role";
}

function roleOptions(selected = "", label = "No role") {
  return `<option value="">${esc(label)}</option>${state.roles.map((role) => `<option value="${role.id}" ${selected === role.id ? "selected" : ""}>${esc(role.name)}</option>`).join("")}`;
}

function getFileTab(id) {
  return state.fileTabs.find((tab) => tab.id === id);
}

function fileTabOptions(selected = "") {
  return `<option value="">No folder</option>${state.fileTabs.map((tab) => `<option value="${tab.id}" ${selected === tab.id ? "selected" : ""}>${esc(tab.name)}</option>`).join("")}`;
}

function visibleFileTabs() {
  return filters.fileRole === "all" ? state.fileTabs : state.fileTabs.filter((tab) => tab.roleId === filters.fileRole);
}

function visibleProjectFiles() {
  if (filters.fileRole === "all") return state.projectFiles;
  return state.projectFiles.filter((file) => {
    const tab = getFileTab(file.tabId);
    return file.roleId === filters.fileRole || tab?.roleId === filters.fileRole;
  });
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "A";
}

function iconSrc(kind) {
  const map = {
    workflow: { bg: "#15151c", fg: "#7a5cff", path: '<path d="M7 8h5v5H7zM16 8h5v5h-5zM7 17h5v5H7zM12 10.5h4M18.5 13v4M12 19.5h4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    dashboard: { bg: "#111114", fg: "#25b8a8", path: '<path d="M7 19V9M14 19V6M21 19v-7" stroke="white" stroke-width="2.2" stroke-linecap="round"/><path d="M6 21h16" stroke="white" stroke-width="1.8" stroke-linecap="round"/>' },
    calendar: { bg: "#12201f", fg: "#25b8a8", path: '<path d="M8 8h12a2 2 0 0 1 2 2v10H6V10a2 2 0 0 1 2-2zM6 12h16M10 6v4M18 6v4" stroke="white" stroke-width="1.8" stroke-linecap="round"/>' },
    purchasing: { bg: "#241c0d", fg: "#ffb547", path: '<path d="M8 10h12v10H8zM10 10a4 4 0 0 1 8 0M11 15h6M11 18h4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    files: { bg: "#1d1626", fg: "#d9415d", path: '<path d="M8 7h7l5 5v9H8zM15 7v5h5M11 16h7M11 19h5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    settings: { bg: "#16171d", fg: "#9b98a8", path: '<path d="M14 9v2M14 17v2M9 14h2M17 14h2M10.5 10.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 10.5l-1.4 1.4M11.9 16.1l-1.4 1.4" stroke="white" stroke-width="1.8" stroke-linecap="round"/><circle cx="14" cy="14" r="2.6" stroke="white" stroke-width="1.8"/>' },
    logo: { bg: "#111114", fg: "#7a5cff", path: '<path d="M7 19 14 7l7 12h-4l-3-5-3 5z" fill="white"/>' },
    theme: { bg: "#111114", fg: "#25b8a8", path: '<path d="M18.5 17.7A7 7 0 0 1 10.3 9.5 7 7 0 1 0 18.5 17.7z" fill="white"/>' },
  };
  const item = map[kind] || map.workflow;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" rx="8" fill="${item.bg}"/><circle cx="21" cy="7" r="3" fill="${item.fg}"/>${item.path}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function iconImg(kind, label = "") {
  return `<img class="micro-image" src="${iconSrc(kind)}" alt="" aria-hidden="true" />${label ? `<span>${esc(label)}</span>` : ""}`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.setProperty("--scale", state.scale);
  const [title, subtitle] = pageMeta[page];
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        <header class="topbar">
          <div>
            <h1 class="page-title">${title}</h1>
            <p class="page-subtitle">${subtitle}</p>
          </div>
          <div class="top-actions">
            <span class="status-pill"><span class="status-dot"></span>Demo storage synced</span>
            <button class="btn" data-action="open-logo">${iconImg("logo", "Logo")}</button>
          </div>
        </header>
        <section class="content">${renderPage()}</section>
      </main>
    </div>
    ${modal ? renderModal() : ""}
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <img src="${esc(state.logo)}" alt="AVA Studios logo" />
        <div class="brand-copy">
          <h2 class="brand-title">AVA Studios</h2>
          <p class="brand-subtitle">Roblox production hub</p>
        </div>
      </div>
      <nav class="nav" aria-label="Primary">
        ${navItems
          .map(
            ([id, icon, label]) => `
              <button class="${page === id ? "active" : ""}" data-page="${id}" title="${label}">
                <span class="icon" aria-hidden="true">${iconImg(icon)}</span>
                <span class="nav-label">${label}</span>
              </button>`
          )
          .join("")}
      </nav>
      <section class="sidebar-section">
        <h3 class="sidebar-heading">Team</h3>
        <div class="team-list">
          ${
            state.members.length
              ? state.members.map(renderMiniMember).join("")
              : `<div class="empty-dark">Add the 3-person team in Settings when ready.</div>`
          }
        </div>
      </section>
      <button class="sidebar-action" data-action="toggle-theme">
        <span class="icon" aria-hidden="true">${iconImg("theme")}</span>
        <span class="nav-label">${state.theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
    </aside>
  `;
}

function renderMiniMember(member) {
  return `
    <div class="member-mini">
      ${renderAvatar(member)}
      <div>
        <div class="mini-name">${esc(member.name)}</div>
        <div class="mini-role">${esc(roleName(member.roleId))}</div>
      </div>
    </div>
  `;
}

function renderAvatar(member) {
  if (member.avatar) return `<span class="avatar"><img src="${esc(member.avatar)}" alt="" /></span>`;
  return `<span class="avatar">${esc(member.initials || initials(member.name))}</span>`;
}

function renderPage() {
  if (page === "workflow") return renderWorkflow();
  if (page === "dashboard") return renderDashboard();
  if (page === "calendar") return renderCalendar();
  if (page === "purchasing") return renderPurchasing();
  if (page === "files") return renderFiles();
  return renderSettings();
}

function renderWorkflow() {
  const focusedPhase = workflowView.focusId ? getPhase(workflowView.focusId) : null;
  return `
    <section class="panel workflow-panel">
      <div class="panel-head">
        <div>
          <h2>Production Phases</h2>
          <p class="description">The template starts with phases only. Tasks and events are added manually from the relevant phase.</p>
        </div>
        <div class="page-actions">
          <button class="btn" data-action="template-modal">Edit Template</button>
          <button class="btn" data-action="reset-template">Reset Template</button>
          <button class="btn danger" data-action="delete-workflow-items">Delete Items</button>
        </div>
      </div>
      <div class="workflow-map ${focusedPhase ? "is-focused" : ""}" data-action="workflow-reset">
        <div class="workflow-track">
          <div class="flow-road"></div>
          <div class="workflow-grid process-grid">
            ${state.phases.map(renderPhaseCard).join("")}
          </div>
        </div>
        ${
          focusedPhase
            ? `<div class="workflow-dim" data-action="workflow-reset"></div>
              <div class="workflow-focus">
                <button class="btn icon-only" data-action="workflow-prev" title="Previous phase">‹</button>
                <div class="focus-card" data-action="noop">${renderFocusedPhase(focusedPhase)}</div>
                <button class="btn icon-only" data-action="workflow-next" title="Next phase">›</button>
              </div>`
            : ""
        }
      </div>
    </section>
  `;
}

function workflowPhaseLayout(index) {
  const perRow = 3;
  const row = Math.floor(index / perRow);
  const position = index % perRow;
  const isForwardRow = row % 2 === 0;
  const nextExists = index < state.phases.length - 1;
  const isRowEnd = position === perRow - 1;
  return {
    column: isForwardRow ? position + 1 : perRow - position,
    row: row + 1,
    arrow: !nextExists ? "none" : isRowEnd ? "down" : isForwardRow ? "right" : "left",
  };
}

function renderPhaseCard(phase, index) {
  const layout = workflowPhaseLayout(index);
  const phaseTasks = state.tasks.filter((task) => task.phaseId === phase.id);
  const phaseEvents = state.events.filter((event) => event.phaseId === phase.id);
  const phasePurchases = state.purchases.filter((purchase) => purchase.phaseId === phase.id);
  return `
    <article class="phase-card process-phase arrow-${layout.arrow} clickable-card" style="--phase-col:${layout.column};--phase-row:${layout.row}" draggable="true" data-drag-kind="phase" data-drag-id="${phase.id}" data-drop-phase="${phase.id}" data-action="workflow-focus" data-id="${phase.id}" tabindex="0" role="button" aria-label="Focus ${esc(phase.title)}">
      <div class="phase-top">
        <div>
          <div class="phase-number">Phase ${phase.number}</div>
          <h3 class="phase-title">${esc(phase.title)}</h3>
        </div>
      </div>
      <p class="description">${esc(phase.description)}</p>
      <div class="task-meta">
        <span class="tag">${esc(phase.roles || "No roles")}</span>
        <span class="tag">${phaseTasks.length} tasks</span>
        <span class="tag">${phaseEvents.length} events</span>
        <span class="tag">${phasePurchases.length} purchases</span>
      </div>
      <div class="workflow-items">
        ${phaseTasks.slice(0, 3).map((task) => `<button class="mini-work-item" draggable="true" data-drag-kind="task" data-drag-id="${task.id}" data-action="task-modal" data-id="${task.id}">${esc(task.title)}</button>`).join("")}
        ${phaseEvents.slice(0, 2).map((event) => `<button class="mini-work-item event" draggable="true" data-drag-kind="event" data-drag-id="${event.id}" data-action="event-modal" data-id="${event.id}">${esc(event.title)}</button>`).join("")}
        ${phasePurchases.slice(0, 2).map((purchase) => `<button class="mini-work-item purchase" draggable="true" data-drag-kind="purchase" data-drag-id="${purchase.id}" data-action="purchase-modal" data-id="${purchase.id}">${esc(purchase.name)}</button>`).join("")}
      </div>
      <div>
        <div class="task-meta"><span>${phase.progress || 0}% progress</span><span>${esc(phase.dependencies || "No dependencies")}</span></div>
        <div class="progress" aria-label="${phase.progress || 0}% progress"><span style="width:${Number(phase.progress || 0)}%"></span></div>
      </div>
      <div class="row-actions">
        <button class="btn primary" data-action="task-modal" data-phase="${phase.id}">Add Task</button>
        <button class="btn" data-action="event-modal" data-phase="${phase.id}">Add Event</button>
      </div>
    </article>
  `;
}

function renderFocusedPhase(phase) {
  const phaseTasks = state.tasks.filter((task) => task.phaseId === phase.id);
  const phaseEvents = state.events.filter((event) => event.phaseId === phase.id);
  const phasePurchases = state.purchases.filter((purchase) => purchase.phaseId === phase.id);
  return `
    <div class="focused-phase-content" data-drop-phase="${phase.id}">
      <div class="phase-number focus-number">Phase ${phase.number}</div>
      <h3>${esc(phase.title)}</h3>
      <p class="description">${esc(phase.description)}</p>
      <div class="task-meta"><span class="tag">${esc(phase.roles || "No roles")}</span><span class="tag">${phase.progress || 0}%</span></div>
      <div class="progress"><span style="width:${Number(phase.progress || 0)}%"></span></div>
      <div class="focus-columns">
        <div><strong>Tasks</strong>${phaseTasks.length ? phaseTasks.map((task) => `<button class="mini-work-item wide" draggable="true" data-drag-kind="task" data-drag-id="${task.id}" data-action="task-modal" data-id="${task.id}">${esc(task.title)}</button>`).join("") : `<p class="description">No tasks yet.</p>`}</div>
        <div><strong>Events</strong>${phaseEvents.length ? phaseEvents.map((event) => `<button class="mini-work-item wide event" draggable="true" data-drag-kind="event" data-drag-id="${event.id}" data-action="event-modal" data-id="${event.id}">${esc(event.title)}</button>`).join("") : `<p class="description">No events yet.</p>`}</div>
        <div><strong>Purchases</strong>${phasePurchases.length ? phasePurchases.map((purchase) => `<button class="mini-work-item wide purchase" draggable="true" data-drag-kind="purchase" data-drag-id="${purchase.id}" data-action="purchase-modal" data-id="${purchase.id}">${esc(purchase.name)}</button>`).join("") : `<p class="description">No purchases yet.</p>`}</div>
      </div>
      <div class="row-actions">
        <button class="btn primary" data-action="phase-modal" data-id="${phase.id}">Edit Phase</button>
        <button class="btn" data-action="task-modal" data-phase="${phase.id}">Add Task</button>
        <button class="btn" data-action="event-modal" data-phase="${phase.id}">Add Event</button>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const visibleTasks = filteredTasks();
  const completed = state.tasks.filter((task) => task.status === "completed").length;
  const activeAreas = new Set(state.tasks.filter((task) => task.status !== "completed").map((task) => task.phaseId)).size;
  return `
    <div class="metrics">
      ${metric("Total Tasks", state.tasks.length)}
      ${metric("Completed", completed)}
      ${metric("Active Areas", activeAreas)}
      ${metric("Assigned Work", state.tasks.filter((task) => task.assigneeId).length)}
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Tasks</h2>
            <p class="description">${selectedTasks.size} selected</p>
          </div>
          <div class="page-actions">
            <button class="btn primary" data-action="task-modal">Add Task</button>
            <button class="btn" data-action="delete-selected-tasks">Delete Selected</button>
            <button class="btn danger" data-action="delete-all-tasks">Delete All</button>
          </div>
        </div>
        <div class="filters">
          <select data-filter="taskStatus" aria-label="Task status">
            ${["all", "to-do", "in-progress", "completed"].map((status) => `<option value="${status}" ${filters.taskStatus === status ? "selected" : ""}>${status.replace("-", " ")}</option>`).join("")}
          </select>
          <select data-filter="taskPhase" aria-label="Task phase">
            <option value="all">all phases</option>
            ${state.phases.map((phase) => `<option value="${phase.id}" ${filters.taskPhase === phase.id ? "selected" : ""}>Phase ${phase.number}</option>`).join("")}
          </select>
          <select data-filter="taskRole" aria-label="Task role">
            <option value="all" ${filters.taskRole === "all" ? "selected" : ""}>all roles</option>
            ${state.roles.map((role) => `<option value="${role.id}" ${filters.taskRole === role.id ? "selected" : ""}>${esc(role.name)}</option>`).join("")}
          </select>
        </div>
        <div class="task-list">
          ${visibleTasks.length ? visibleTasks.map(renderTaskCard).join("") : empty("No tasks yet. Add one when the team is ready to assign work.")}
        </div>
      </section>
      <aside class="grid">
        <section class="analytics-panel">
          <h3>Upcoming</h3>
          <div class="task-list">${renderUpcoming()}</div>
        </section>
        <section class="analytics-panel">
          <h3>Completion</h3>
          <p class="description">${state.tasks.length ? `${Math.round((completed / state.tasks.length) * 100)}% of manually created tasks are complete.` : "No task data yet."}</p>
          <div class="progress"><span style="width:${state.tasks.length ? (completed / state.tasks.length) * 100 : 0}%"></span></div>
        </section>
      </aside>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div></div>`;
}

function filteredTasks() {
  return state.tasks.filter((task) => {
    const statusOk = filters.taskStatus === "all" || task.status === filters.taskStatus;
    const phaseOk = filters.taskPhase === "all" || task.phaseId === filters.taskPhase;
    const roleOk = filters.taskRole === "all" || task.roleId === filters.taskRole;
    return statusOk && phaseOk && roleOk;
  });
}

function renderTaskCard(task) {
  const member = getMember(task.assigneeId);
  const phase = getPhase(task.phaseId);
  return `
    <article class="task-card clickable-card" draggable="true" data-drag-kind="task" data-drag-id="${task.id}" data-action="task-modal" data-id="${task.id}" tabindex="0" role="button" aria-label="Edit ${esc(task.title)}">
      <div class="task-top">
        <div class="task-row">
          <input class="task-select" type="checkbox" aria-label="Select task" data-action="select-task" data-id="${task.id}" ${selectedTasks.has(task.id) ? "checked" : ""} />
          <div class="task-copy">
            <h3 class="task-title">${esc(task.title)}</h3>
            <div class="task-meta">
              <span class="status ${task.status}">${task.status.replace("-", " ")}</span>
              <span>${esc(roleName(task.roleId))}</span>
              <span>${esc(member?.name || "Unassigned")}</span>
              <span>${esc(phase ? `Phase ${phase.number}` : "No phase")}</span>
              <span>${formatDate(task.dueDate)}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderUpcoming() {
  const items = [
    ...state.tasks.filter((task) => task.dueDate).map((task) => ({ type: "Task", action: "task-modal", id: task.id, title: task.title, date: task.dueDate })),
    ...state.events.map((event) => ({ type: "Event", action: "event-modal", id: event.id, title: event.title, date: event.date })),
    ...state.purchases.map((purchase) => ({ type: "Purchase", action: "purchase-modal", id: purchase.id, title: purchase.name, date: purchase.date })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  if (!items.length) return empty("No upcoming dates yet.");
  return items.map((item) => `<div class="task-card clickable-card" data-action="${item.action}" data-id="${item.id}" tabindex="0" role="button"><strong>${esc(item.title)}</strong><div class="task-meta"><span>${item.type}</span><span>${formatDate(item.date)}</span></div></div>`).join("");
}

function renderCalendar() {
  return `
    <section class="panel">
      <div class="calendar-toolbar">
        <div class="row-actions">
          <button class="btn icon-only" title="Previous" data-action="calendar-prev">‹</button>
          <button class="btn icon-only" title="Next" data-action="calendar-next">›</button>
          <h2>${calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        </div>
        <div class="row-actions">
          <div class="segmented">
            <button class="${filters.calendarView === "month" ? "active" : ""}" data-action="calendar-view" data-view="month">Month</button>
            <button class="${filters.calendarView === "week" ? "active" : ""}" data-action="calendar-view" data-view="week">Week</button>
          </div>
          <span class="status-pill">Click a date to manage tasks</span>
        </div>
      </div>
    </section>
    <div class="calendar-layout">
      <section class="calendar-grid ${filters.calendarView === "week" ? "week-grid" : ""}">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="weekday">${day}</div>`).join("")}
        ${renderCalendarCells()}
      </section>
      <aside class="availability-panel">
        <div class="panel-head compact-head">
          <div>
            <h3>Team Availability</h3>
            <p class="description">Overlaps are flagged when one person is booked at the same time.</p>
          </div>
        </div>
        ${renderAvailabilityList()}
      </aside>
    </div>
  `;
}

function renderCalendarCells() {
  const dates = filters.calendarView === "week" ? weekDates(calendarDate) : monthDates(calendarDate);
  const currentMonth = calendarDate.getMonth();
  return dates
    .map((date) => {
      const iso = date.toISOString().slice(0, 10);
      const items = calendarItems(iso);
      return `
        <div class="calendar-cell ${date.getMonth() !== currentMonth && filters.calendarView === "month" ? "muted" : ""}" data-drop-date="${iso}" data-action="date-tasks-modal" data-date="${iso}" tabindex="0" role="button" aria-label="Manage tasks for ${iso}">
          <button class="date-number" data-action="date-tasks-modal" data-date="${iso}">${date.getDate()}</button>
          ${items.map(renderCalendarItem).join("")}
        </div>
      `;
    })
    .join("");
}

function monthDates(base) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function weekDates(base) {
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function calendarItems(iso) {
  return [
    ...state.events.filter((event) => event.date === iso).map((event) => ({ kind: "event", id: event.id, title: event.title, conflict: eventConflicts(event).length > 0 })),
    ...state.tasks.filter((task) => task.dueDate === iso).map((task) => ({ kind: "task", id: task.id, title: task.title })),
    ...state.purchases.filter((purchase) => purchase.date === iso).map((purchase) => ({ kind: "purchase", id: purchase.id, title: purchase.name })),
  ];
}

function renderCalendarItem(item) {
  const action = item.kind === "event" ? "event-modal" : item.kind === "task" ? "task-modal" : "purchase-modal";
  return `<button class="calendar-item ${item.kind} ${item.conflict ? "conflict" : ""}" draggable="true" data-drag-kind="${item.kind}" data-drag-id="${item.id}" data-action="${action}" data-id="${item.id}">${item.conflict ? "Overlap - " : ""}${esc(item.title)}</button>`;
}

function timeToMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function eventRange(event) {
  const start = timeToMinutes(event.time);
  if (start === null) return null;
  const explicitEnd = timeToMinutes(event.endTime);
  const end = explicitEnd !== null && explicitEnd > start ? explicitEnd : start + 60;
  return { start, end };
}

function eventConflicts(event) {
  if (!event.assigneeId || !event.date) return [];
  const range = eventRange(event);
  if (!range) return [];
  return state.events.filter((other) => {
    if (other.id === event.id || other.assigneeId !== event.assigneeId || other.date !== event.date) return false;
    const otherRange = eventRange(other);
    if (!otherRange) return false;
    return range.start < otherRange.end && otherRange.start < range.end;
  });
}

function renderAvailabilityList() {
  if (!state.members.length) return empty("Add team members in Settings to see availability.");
  return `<div class="availability-list">${state.members.map(renderAvailabilityMember).join("")}</div>`;
}

function renderAvailabilityMember(member) {
  const events = state.events
    .filter((event) => event.assigneeId === member.id)
    .sort((a, b) => `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`))
    .slice(0, 4);
  const conflictCount = state.events.filter((event) => event.assigneeId === member.id && eventConflicts(event).length > 0).length;
  return `
    <div class="availability-member">
      <div class="member-top">
        <div class="form-row">${renderAvatar(member)}<div><strong>${esc(member.name)}</strong><div class="task-meta"><span>${esc(member.availability || "Availability not set")}</span></div></div></div>
        ${conflictCount ? `<span class="tag danger-tag">${conflictCount} overlap${conflictCount === 1 ? "" : "s"}</span>` : `<span class="tag">Clear</span>`}
      </div>
      <div class="availability-events">
        ${events.length ? events.map((event) => `<button class="availability-event ${eventConflicts(event).length ? "conflict" : ""}" data-action="event-modal" data-id="${event.id}">${formatDate(event.date)} ${esc(event.time || "")} ${event.endTime ? `- ${esc(event.endTime)}` : ""} · ${esc(event.title)}</button>`).join("") : `<span class="description">No scheduled events yet.</span>`}
      </div>
    </div>
  `;
}

function renderPurchasing() {
  const total = state.purchases.reduce((sum, purchase) => sum + Number(purchase.cost || 0), 0);
  const outstanding = state.purchases.filter((purchase) => purchase.status === "pending").reduce((sum, purchase) => sum + Number(purchase.cost || 0), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthly = state.purchases.filter((purchase) => purchase.date?.startsWith(currentMonth)).reduce((sum, purchase) => sum + Number(purchase.cost || 0), 0);
  return `
    <div class="metrics">
      ${metric("Total Spend", money(total))}
      ${metric("Outstanding", money(outstanding))}
      ${metric("This Month", money(monthly))}
      ${metric("Purchases", state.purchases.length)}
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Purchase Records</h2>
          <p class="description">Receipts, invoices, screenshots, and payment notes live with each purchase.</p>
        </div>
        <button class="btn primary" data-action="purchase-modal">Add Purchase</button>
      </div>
      <div class="purchase-list">${state.purchases.length ? renderPurchaseGroups() : empty("No purchases yet.")}</div>
    </section>
  `;
}

function youtubeEmbedUrl(url = "") {
  const value = url.trim();
  if (!value) return "";
  const patterns = [/youtu\.be\/([\w-]+)/, /youtube\.com\/watch\?v=([\w-]+)/, /youtube\.com\/shorts\/([\w-]+)/, /youtube\.com\/embed\/([\w-]+)/];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
}

function fileKind(file) {
  if (file.youtubeUrl) return "YouTube Video";
  const type = file.mimeType || "";
  if (type.startsWith("image/")) return "Image";
  if (type.startsWith("video/")) return "Video";
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return "Document";
  return file.kind || "File";
}

function renderFiles() {
  const tabs = visibleFileTabs();
  const files = visibleProjectFiles();
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Studio Files</h2>
          <p class="description">Attach game footage, references, thumbnails, UI exports, scripts, notes, and planning documents.</p>
        </div>
        <div class="page-actions">
          <select data-filter="fileRole" aria-label="Filter files by role">
            <option value="all" ${filters.fileRole === "all" ? "selected" : ""}>All roles</option>
            ${state.roles.map((role) => `<option value="${role.id}" ${filters.fileRole === role.id ? "selected" : ""}>${esc(role.name)}</option>`).join("")}
          </select>
          <button class="btn" data-action="file-tabs-modal">Edit Tabs</button>
          <button class="btn primary" data-action="file-modal">Add File</button>
        </div>
      </div>
      <div class="file-board">
        ${renderFileSection(filters.fileRole === "all" ? "All Files" : `${roleName(filters.fileRole)} Files`, files, "")}
        ${tabs.map((tab) => renderFileSection(tab.name, state.projectFiles.filter((file) => file.tabId === tab.id), tab.id, tab.roleId)).join("")}
      </div>
    </section>
  `;
}

function renderFileSection(title, files, tabId = "", roleId = "") {
  return `
    <section class="file-section" ${tabId ? `data-drop-file-tab="${esc(tabId)}"` : ""}>
      <div class="file-section-head">
        <div>
          <h3>${esc(title)}</h3>
          ${tabId ? `<p class="description">${esc(roleId ? roleName(roleId) : "No role assigned")}</p>` : ""}
        </div>
        <span class="tag">${files.length} file${files.length === 1 ? "" : "s"}</span>
      </div>
      <div class="file-list">
        ${files.length ? files.map(renderFileCard).join("") : `<div class="empty-state compact-empty">No files attached here yet.</div>`}
      </div>
    </section>
  `;
}

function renderFileCard(file) {
  const embed = youtubeEmbedUrl(file.youtubeUrl || "");
  const tab = getFileTab(file.tabId);
  return `
    <article class="file-card clickable-card" draggable="true" data-drag-kind="file" data-drag-id="${file.id}" data-action="file-modal" data-id="${file.id}" tabindex="0" role="button" aria-label="Edit ${esc(file.title || file.name)}">
      <div class="file-kind">${fileKind(file)}</div>
      <strong>${esc(file.title || file.name)}</strong>
      <div class="task-meta"><span>${esc(tab?.name || "No folder")}</span><span>${esc(roleName(file.roleId || tab?.roleId))}</span><span>${fileSize(file.size)}</span></div>
      <p class="description">${esc(file.notes || "No notes yet.")}</p>
      ${embed ? `<iframe class="video-embed" src="${esc(embed)}" title="${esc(file.title || "YouTube video")}" loading="lazy" allowfullscreen data-no-card-click></iframe>` : ""}
      ${file.dataUrl ? `<a class="btn" href="${esc(file.dataUrl)}" download="${esc(file.name)}" target="_blank" rel="noreferrer" data-no-card-click>Open</a>` : ""}
    </article>
  `;
}

function renderPurchaseGroups() {
  const groups = state.purchases.reduce((acc, purchase) => {
    const key = purchase.date ? purchase.date.slice(0, 7) : "Unscheduled";
    acc[key] ||= [];
    acc[key].push(purchase);
    return acc;
  }, {});
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, purchases]) => {
      const sum = purchases.reduce((total, purchase) => total + Number(purchase.cost || 0), 0);
      return `
        <div class="purchase-month">
          <div class="month-head"><strong>${esc(monthLabel(month))}</strong><span>${money(sum)}</span></div>
          ${purchases.map(renderPurchaseRow).join("")}
        </div>
      `;
    })
    .join("");
}

function monthLabel(month) {
  if (month === "Unscheduled") return month;
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function renderPurchaseRow(purchase) {
  const purchaser = getMember(purchase.purchaserId);
  return `
    <div class="purchase-row clickable-card" draggable="true" data-drag-kind="purchase" data-drag-id="${purchase.id}" data-action="purchase-modal" data-id="${purchase.id}" tabindex="0" role="button" aria-label="Edit ${esc(purchase.name)}">
      <div>
        <strong>${esc(purchase.name)}</strong>
        <div class="purchase-meta"><span>${esc(purchase.category || "General")}</span><span>${esc(purchaser?.name || "Unassigned")}</span></div>
      </div>
      <span>${money(purchase.cost)}</span>
      <span class="status ${purchase.status}">${purchase.status}</span>
      <span>${formatDate(purchase.date)}</span>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Display</h2>
            <p class="description">Keep the tool comfortable for a small studio working across laptops and tablets.</p>
          </div>
        </div>
        <div class="setting-line">
          <strong>Theme</strong>
          <div class="segmented">
            <button class="${state.theme === "light" ? "active" : ""}" data-action="set-theme" data-theme="light">Light</button>
            <button class="${state.theme === "dark" ? "active" : ""}" data-action="set-theme" data-theme="dark">Dark</button>
          </div>
        </div>
        <div class="setting-line">
          <strong>UI Scale</strong>
          <input style="max-width:240px" type="range" min="0.9" max="1.12" step="0.01" value="${state.scale}" data-action="scale" />
        </div>
        <div class="setting-line">
          <strong>Project Data</strong>
          <button class="btn danger" data-action="clear-data">Clear Data</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Team Members</h2>
            <p class="description">Members are linked to roles, and roles drive task and file visibility.</p>
          </div>
          <button class="btn primary" data-action="member-modal">Add Member</button>
        </div>
        <div class="member-grid">
          ${state.members.length ? state.members.map(renderMemberCard).join("") : empty("No team members yet.")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Roles</h2>
            <p class="description">Create studio roles, then assign them to members, tasks, and file folders.</p>
          </div>
          <button class="btn primary" data-action="role-modal">Add Role</button>
        </div>
        <div class="member-grid">
          ${state.roles.length ? state.roles.map(renderRoleCard).join("") : empty("No roles yet.")}
        </div>
      </section>
    </div>
  `;
}

function renderMemberCard(member) {
  return `
    <article class="member-card clickable-card" data-action="member-modal" data-id="${member.id}" tabindex="0" role="button" aria-label="Edit ${esc(member.name)}">
      <div class="member-top">
        <div class="form-row">
          ${renderAvatar(member)}
          <div>
            <strong>${esc(member.name)}</strong>
            <div class="task-meta"><span>${esc(roleName(member.roleId))}</span><span>${esc(member.availability || "Availability not set")}</span></div>
          </div>
        </div>
      </div>
      <p class="description">${esc(member.description || "No description yet.")}</p>
    </article>
  `;
}

function renderRoleCard(role) {
  const memberCount = state.members.filter((member) => member.roleId === role.id).length;
  const taskCount = state.tasks.filter((task) => task.roleId === role.id).length;
  const tabCount = state.fileTabs.filter((tab) => tab.roleId === role.id).length;
  return `
    <article class="member-card clickable-card" data-action="role-modal" data-id="${role.id}" tabindex="0" role="button" aria-label="Edit ${esc(role.name)}">
      <div class="member-top">
        <div>
          <strong>${esc(role.name)}</strong>
          <div class="task-meta"><span>${memberCount} members</span><span>${taskCount} tasks</span><span>${tabCount} folders</span></div>
        </div>
      </div>
      <p class="description">${esc(role.description || "Used for filtering what work and file folders this role should see.")}</p>
    </article>
  `;
}

function empty(text) {
  return `<div class="empty-state">${esc(text)}</div>`;
}

function renderModal() {
  const modalRenderers = {
    logo: renderLogoModal,
    task: renderTaskModal,
    event: renderEventModal,
    purchase: renderPurchaseModal,
    member: renderMemberModal,
    role: renderRoleModal,
    phase: renderPhaseModal,
    template: renderTemplateModal,
    file: renderFileModal,
    fileTabs: renderFileTabsModal,
    fileTab: renderFileTabModal,
    dateTasks: renderDateTasksModal,
  };
  return `<div class="modal-backdrop" data-backdrop>${modalRenderers[modal.type]()}</div>`;
}

function modalShell(title, body, footer = "") {
  return `
    <section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-modal-surface>
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="btn icon-only" title="Close" data-action="close-modal">X</button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">${footer || `<span></span><button class="btn primary" data-action="save-modal">Save</button>`}</footer>
    </section>
  `;
}

function editFooter(deleteAction, id) {
  return `${id ? `<button class="btn danger" data-action="${deleteAction}" data-id="${id}">Delete</button>` : `<span></span>`}<div class="row-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-modal">Save</button></div>`;
}

function renderLogoModal() {
  return modalShell(
    "Studio Logo",
    `<div class="form-grid">
      <div class="field full"><label>Logo image</label><input type="file" accept="image/*" id="logoFile" /></div>
      <div class="field full"><label>Current path</label><input name="logo" value="${esc(state.logo)}" /></div>
    </div>`
  );
}

function phaseOptions(selected = "") {
  return `<option value="">No phase</option>${state.phases.map((phase) => `<option value="${phase.id}" ${selected === phase.id ? "selected" : ""}>Phase ${phase.number}: ${esc(phase.title)}</option>`).join("")}`;
}

function memberOptions(selected = "") {
  return `<option value="">Unassigned</option>${state.members.map((member) => `<option value="${member.id}" ${selected === member.id ? "selected" : ""}>${esc(member.name)}</option>`).join("")}`;
}

function renderTaskModal() {
  const item = state.tasks.find((task) => task.id === modal.id) || { title: "", status: "to-do", roleId: "", phaseId: modal.phase || "", assigneeId: "", dueDate: modal.date || "", description: "" };
  return modalShell(
    item.id ? "Edit Task" : "Add Task",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field full"><label>Title</label><input name="title" required value="${esc(item.title)}" /></div>
      <div class="field"><label>Status</label><select name="status">
        ${["to-do", "in-progress", "completed"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status.replace("-", " ")}</option>`).join("")}
      </select></div>
      <div class="field"><label>Role</label><select name="roleId">${roleOptions(item.roleId)}</select></div>
      <div class="field"><label>Assignee</label><select name="assigneeId">${memberOptions(item.assigneeId)}</select></div>
      <div class="field"><label>Workflow Phase</label><select name="phaseId">${phaseOptions(item.phaseId)}</select></div>
      <div class="field"><label>Deadline</label><input type="date" name="dueDate" value="${esc(item.dueDate)}" /></div>
      <div class="field full"><label>Description</label><textarea name="description">${esc(item.description)}</textarea></div>
      ${renderAttachmentSection("task", item.id)}
    </form>`,
    editFooter("delete-task", item.id)
  );
}

function renderEventModal() {
  const item = state.events.find((event) => event.id === modal.id) || { title: "", description: "", date: modal.date || todayISO(), time: "", endTime: "", phaseId: modal.phase || "", assigneeId: "" };
  const conflicts = item.id ? eventConflicts(item) : [];
  return modalShell(
    item.id ? "Edit Event" : "Add Event",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field full"><label>Title</label><input name="title" required value="${esc(item.title)}" /></div>
      <div class="field"><label>Date</label><input type="date" name="date" required value="${esc(item.date)}" /></div>
      <div class="field"><label>Start Time</label><input type="time" name="time" value="${esc(item.time)}" /></div>
      <div class="field"><label>End Time</label><input type="time" name="endTime" value="${esc(item.endTime)}" /></div>
      <div class="field"><label>Workflow Phase</label><select name="phaseId">${phaseOptions(item.phaseId)}</select></div>
      <div class="field"><label>Assignee</label><select name="assigneeId">${memberOptions(item.assigneeId)}</select></div>
      ${conflicts.length ? `<div class="field full conflict-note">Overlaps with ${conflicts.map((event) => esc(event.title)).join(", ")}</div>` : ""}
      <div class="field full"><label>Description</label><textarea name="description">${esc(item.description)}</textarea></div>
      ${renderAttachmentSection("event", item.id)}
    </form>`,
    editFooter("delete-event", item.id)
  );
}

function renderPurchaseModal() {
  const item = state.purchases.find((purchase) => purchase.id === modal.id) || { name: "", category: "", cost: "", purchaserId: "", status: "pending", date: todayISO(), phaseId: "", notes: "", split: "" };
  return modalShell(
    item.id ? "Edit Purchase" : "Add Purchase",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field full"><label>Item Name</label><input name="name" required value="${esc(item.name)}" /></div>
      <div class="field"><label>Category</label><input name="category" value="${esc(item.category)}" /></div>
      <div class="field"><label>Cost</label><input type="number" min="0" step="0.01" name="cost" value="${esc(item.cost)}" /></div>
      <div class="field"><label>Purchaser</label><select name="purchaserId">${memberOptions(item.purchaserId)}</select></div>
      <div class="field"><label>Status</label><select name="status"><option value="pending" ${item.status === "pending" ? "selected" : ""}>pending</option><option value="paid" ${item.status === "paid" ? "selected" : ""}>paid</option></select></div>
      <div class="field"><label>Date</label><input type="date" name="date" value="${esc(item.date)}" /></div>
      <div class="field"><label>Workflow Phase</label><select name="phaseId">${phaseOptions(item.phaseId)}</select></div>
      <div class="field full"><label>Payment Split</label><input name="split" value="${esc(item.split)}" placeholder="Example: Ava $12, Mia $12, Ren $12" /></div>
      <div class="field full"><label>Notes</label><textarea name="notes">${esc(item.notes)}</textarea></div>
      ${renderAttachmentSection("purchase", item.id)}
    </form>`,
    editFooter("delete-purchase", item.id)
  );
}

function renderMemberModal() {
  const item = state.members.find((member) => member.id === modal.id) || { name: "", roleId: "", initials: "", availability: "", description: "", avatar: "" };
  return modalShell(
    item.id ? "Edit Member" : "Add Member",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field"><label>Name</label><input name="name" required value="${esc(item.name)}" /></div>
      <div class="field"><label>Role</label><select name="roleId">${roleOptions(item.roleId)}</select></div>
      <div class="field"><label>Initials</label><input name="initials" maxlength="3" value="${esc(item.initials)}" /></div>
      <div class="field"><label>Avatar</label><input type="file" accept="image/*" id="memberAvatar" /></div>
      <input type="hidden" name="avatar" value="${esc(item.avatar)}" />
      <div class="field full"><label>Availability</label><input name="availability" value="${esc(item.availability || "")}" placeholder="Example: Mon-Fri 6-10 PM, weekends flexible" /></div>
      <div class="field full"><label>Description</label><textarea name="description">${esc(item.description)}</textarea></div>
    </form>`,
    editFooter("delete-member", item.id)
  );
}

function renderRoleModal() {
  const item = state.roles.find((role) => role.id === modal.id) || { name: "", description: "" };
  return modalShell(
    item.id ? "Edit Role" : "Add Role",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field full"><label>Role Name</label><input name="name" required value="${esc(item.name)}" /></div>
      <div class="field full"><label>Description</label><textarea name="description" placeholder="What this role is responsible for...">${esc(item.description || "")}</textarea></div>
    </form>`,
    editFooter("delete-role", item.id)
  );
}

function renderPhaseModal() {
  const item = state.phases.find((phase) => phase.id === modal.id);
  return modalShell(
    "Edit Phase",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id)}" />
      <div class="field"><label>Phase Number</label><input type="number" min="1" name="number" value="${item.number}" /></div>
      <div class="field"><label>Progress</label><input type="number" min="0" max="100" name="progress" value="${item.progress || 0}" /></div>
      <div class="field full"><label>Title</label><input name="title" required value="${esc(item.title)}" /></div>
      <div class="field full"><label>Description</label><textarea name="description">${esc(item.description)}</textarea></div>
      <div class="field"><label>Assigned Roles</label><input name="roles" value="${esc(item.roles)}" /></div>
      <div class="field"><label>Dependencies</label><input name="dependencies" value="${esc(item.dependencies)}" /></div>
    </form>`,
    editFooter("delete-phase", item.id)
  );
}

function renderFileModal() {
  const item = state.projectFiles.find((file) => file.id === modal.id) || { title: "", name: "", tabId: "", roleId: "", notes: "", youtubeUrl: "", mimeType: "", size: 0, dataUrl: "" };
  return modalShell(
    item.id ? "Edit File" : "Add File",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <input type="hidden" name="dataUrl" value="${esc(item.dataUrl || "")}" />
      <input type="hidden" name="name" value="${esc(item.name || "")}" />
      <input type="hidden" name="mimeType" value="${esc(item.mimeType || "")}" />
      <input type="hidden" name="size" value="${esc(item.size || 0)}" />
      <div class="field full"><label>File</label><input type="file" id="projectFile" accept=".pdf,image/*,video/*,.svg,.webp,.gif,.mov,.mp4,.webm,.doc,.docx,.txt" /></div>
      <div class="field full"><label>Title</label><input name="title" value="${esc(item.title || "")}" placeholder="${esc(item.name || "Reference file")}" /></div>
      <div class="field"><label>Folder</label><select name="tabId">${fileTabOptions(item.tabId)}</select></div>
      <div class="field"><label>Role Override</label><select name="roleId">${roleOptions(item.roleId, "Inherit folder role")}</select></div>
      <div class="field"><label>Current File</label><input value="${esc(item.name || "No file selected yet")}" disabled /></div>
      <div class="field full"><label>YouTube Link</label><input name="youtubeUrl" value="${esc(item.youtubeUrl || "")}" placeholder="https://www.youtube.com/watch?v=..." /></div>
      <div class="field full"><label>Notes</label><textarea name="notes">${esc(item.notes || "")}</textarea></div>
    </form>`,
    editFooter("delete-file", item.id)
  );
}

function renderDateTasksModal() {
  const date = modal.date || todayISO();
  const tasks = state.tasks.filter((task) => task.dueDate === date);
  return modalShell(
    `Tasks for ${formatDate(date)}`,
    `<div class="task-list date-task-list" data-drop-date="${date}">
      ${
        tasks.length
          ? tasks.map((task) => `<div class="task-card clickable-card" draggable="true" data-drag-kind="task" data-drag-id="${task.id}" data-action="task-modal" data-id="${task.id}" tabindex="0" role="button"><strong>${esc(task.title)}</strong><div class="task-meta"><span>${task.status.replace("-", " ")}</span><span>${esc(roleName(task.roleId))}</span></div></div>`).join("")
          : `<div class="empty-state compact-empty">No tasks on this date. Add one or drag a task here.</div>`
      }
    </div>`,
    `<button class="btn danger" data-action="delete-date-tasks" data-date="${date}">Remove Date Tasks</button><div class="row-actions"><button class="btn" data-action="close-modal">Done</button><button class="btn primary" data-action="task-modal" data-date="${date}">Add Task</button></div>`
  );
}

function renderFileTabsModal() {
  return modalShell(
    "File Folders",
    `<div class="task-list">
      ${state.fileTabs
        .map(
          (tab, index) => `
          <div class="task-card clickable-card" draggable="true" data-drag-kind="file-tab" data-drag-id="${esc(tab.id)}" data-drop-file-tab="${esc(tab.id)}" data-action="file-tab-modal" data-id="${esc(tab.id)}" tabindex="0" role="button">
            <div class="task-top">
              <div><strong>${esc(tab.name)}</strong><div class="task-meta"><span>${esc(tab.roleId ? roleName(tab.roleId) : "No role")}</span><span>${state.projectFiles.filter((file) => file.tabId === tab.id).length} files</span></div></div>
              <div class="row-actions">
                <button class="btn icon-only" title="Move up" data-action="file-tab-up" data-id="${esc(tab.id)}" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="btn icon-only" title="Move down" data-action="file-tab-down" data-id="${esc(tab.id)}" ${index === state.fileTabs.length - 1 ? "disabled" : ""}>↓</button>
              </div>
            </div>
          </div>`
        )
        .join("")}
    </div>`,
    `<button class="btn" data-action="add-file-tab">Create Folder</button><div class="row-actions"><button class="btn primary" data-action="close-modal">Done</button></div>`
  );
}

function renderFileTabModal() {
  const item = state.fileTabs.find((tab) => tab.id === modal.id) || { name: "", roleId: "" };
  return modalShell(
    item.id ? "Edit File Folder" : "Create File Folder",
    `<form class="form-grid" id="modalForm">
      <input type="hidden" name="id" value="${esc(item.id || "")}" />
      <div class="field full"><label>Folder Name</label><input name="name" required value="${esc(item.name)}" /></div>
      <div class="field full"><label>Assigned Role</label><select name="roleId">${roleOptions(item.roleId)}</select></div>
    </form>`,
    `${item.id ? `<button class="btn danger" data-action="delete-file-tab" data-id="${esc(item.id)}">Delete</button>` : `<span></span>`}<div class="row-actions"><button class="btn" data-action="file-tabs-modal">Back</button><button class="btn primary" data-action="save-modal">Save</button></div>`
  );
}

function renderTemplateModal() {
  return modalShell(
    "Workflow Template",
    `<div class="task-list">
      ${state.phases
        .map(
          (phase, index) => `
          <div class="task-card clickable-card" draggable="true" data-drag-kind="phase" data-drag-id="${phase.id}" data-drop-phase="${phase.id}" data-action="phase-modal" data-id="${phase.id}" tabindex="0" role="button" aria-label="Edit ${esc(phase.title)}">
            <div class="task-top">
              <div><div class="phase-number template-phase-number">Phase ${phase.number}</div><strong>${esc(phase.title)}</strong><div class="task-meta"><span>${esc(phase.roles || "No roles")}</span></div></div>
              <div class="row-actions">
                <button class="btn icon-only" title="Move up" data-action="phase-up" data-id="${phase.id}" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="btn icon-only" title="Move down" data-action="phase-down" data-id="${phase.id}" ${index === state.phases.length - 1 ? "disabled" : ""}>↓</button>
              </div>
            </div>
          </div>`
        )
        .join("")}
    </div>`,
    `<button class="btn" data-action="add-phase">Create Phase</button><div class="row-actions"><button class="btn" data-action="restore-base-template">Restore Base</button><button class="btn primary" data-action="close-modal">Done</button></div>`
  );
}

function renderAttachmentSection(parentType, parentId) {
  const existing = parentId ? state.attachments.filter((file) => file.parentType === parentType && file.parentId === parentId) : [];
  return `
    <div class="field full attachments">
      <label>Attachments</label>
      <input type="file" id="attachmentFiles" multiple accept=".pdf,image/*,video/*,.svg,.webp,.gif,.mov,.mp4,.webm" />
      <div id="attachmentList">
        ${
          existing.length
            ? existing.map(renderAttachmentRow).join("")
            : `<div class="empty-state">No files attached.</div>`
        }
      </div>
    </div>
  `;
}

function renderAttachmentRow(file) {
  return `
    <div class="attachment-row">
      <div>
        <div class="attachment-name">${esc(file.name)}</div>
        <div class="attachment-meta"><span>${esc(file.type || "file")}</span><span>${fileSize(file.size)}</span><span>${formatDate(file.uploadedAt?.slice(0, 10))}</span></div>
      </div>
      <div class="row-actions">
        <a class="btn" href="${esc(file.dataUrl)}" download="${esc(file.name)}" target="_blank" rel="noreferrer">Open</a>
        <button class="btn icon-only" title="Remove attachment" data-action="delete-attachment" data-id="${file.id}">X</button>
      </div>
    </div>
  `;
}

function formData() {
  const form = document.getElementById("modalForm");
  return form ? Object.fromEntries(new FormData(form).entries()) : {};
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function collectAttachments(parentType, parentId) {
  const input = document.getElementById("attachmentFiles");
  if (!input?.files?.length) return;
  for (const file of input.files) {
    state.attachments.push({
      id: uid("attachment"),
      parentType,
      parentId,
      name: file.name,
      type: file.type || "unknown",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploaderId: "",
      dataUrl: await readFileAsDataUrl(file),
    });
  }
}

async function saveModal() {
  const activeForm = document.getElementById("modalForm");
  if (activeForm && !activeForm.reportValidity()) return;

  if (modal.type === "logo") {
    const logoFile = document.getElementById("logoFile")?.files?.[0];
    const manual = document.querySelector('[name="logo"]')?.value.trim();
    state.logo = logoFile ? await readFileAsDataUrl(logoFile) : manual || state.logo;
  }

  if (modal.type === "task") {
    const data = formData();
    const id = data.id || uid("task");
    const task = { id, title: data.title, status: data.status, roleId: data.roleId, assigneeId: data.assigneeId, phaseId: data.phaseId, dueDate: data.dueDate, description: data.description };
    upsert("tasks", task);
    await collectAttachments("task", id);
  }

  if (modal.type === "event") {
    const data = formData();
    const id = data.id || uid("event");
    const event = { id, title: data.title, description: data.description, date: data.date, time: data.time, endTime: data.endTime, phaseId: data.phaseId, assigneeId: data.assigneeId };
    upsert("events", event);
    await collectAttachments("event", id);
  }

  if (modal.type === "purchase") {
    const data = formData();
    const id = data.id || uid("purchase");
    const purchase = { id, name: data.name, category: data.category, cost: data.cost, purchaserId: data.purchaserId, status: data.status, date: data.date, phaseId: data.phaseId, notes: data.notes, split: data.split };
    upsert("purchases", purchase);
    await collectAttachments("purchase", id);
  }

  if (modal.type === "member") {
    const data = formData();
    const avatarFile = document.getElementById("memberAvatar")?.files?.[0];
    const id = data.id || uid("member");
    const member = {
      id,
      name: data.name,
      roleId: data.roleId,
      role: roleName(data.roleId),
      initials: data.initials || initials(data.name),
      availability: data.availability,
      description: data.description,
      avatar: avatarFile ? await readFileAsDataUrl(avatarFile) : data.avatar,
    };
    upsert("members", member);
  }

  if (modal.type === "role") {
    const data = formData();
    const name = data.name.trim();
    if (!name) return;
    const id = data.id || `role-${slug(name)}-${Date.now().toString(16).slice(-4)}`;
    upsert("roles", { id, name, description: data.description.trim() });
  }

  if (modal.type === "file") {
    const data = formData();
    const upload = document.getElementById("projectFile")?.files?.[0];
    const id = data.id || uid("file");
    const file = {
      id,
      title: data.title,
      tabId: data.tabId,
      roleId: data.roleId || state.fileTabs.find((tab) => tab.id === data.tabId)?.roleId || "",
      notes: data.notes,
      youtubeUrl: data.youtubeUrl,
      name: upload ? upload.name : data.name,
      mimeType: upload ? upload.type || "unknown" : data.mimeType,
      size: upload ? upload.size : Number(data.size || 0),
      dataUrl: upload ? await readFileAsDataUrl(upload) : data.dataUrl,
      updatedAt: new Date().toISOString(),
    };
    upsert("projectFiles", file);
  }

  if (modal.type === "fileTab") {
    const data = formData();
    const id = data.id || `tab-${slug(data.name)}-${Date.now().toString(16).slice(-4)}`;
    const name = data.name.trim();
    if (!name) return;
    upsert("fileTabs", { id, name, roleId: data.roleId });
    state.projectFiles.forEach((file) => {
      if (file.tabId === id && !file.roleId) file.roleId = data.roleId;
    });
    state.fileTabs = normalizeFileTabs(state.fileTabs);
    modal = { type: "fileTabs" };
    saveState();
    render();
    return;
  }

  if (modal.type === "phase") {
    const data = formData();
    const phase = state.phases.find((item) => item.id === data.id);
    Object.assign(phase, {
      number: Number(data.number),
      title: data.title,
      description: data.description,
      roles: data.roles,
      dependencies: data.dependencies,
      progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
    });
    sortPhases();
  }

  modal = null;
  saveState();
  render();
}

function upsert(collection, item) {
  const index = state[collection].findIndex((existing) => existing.id === item.id);
  if (index >= 0) state[collection][index] = item;
  else state[collection].push(item);
}

function removeParentAttachments(parentType, parentId) {
  state.attachments = state.attachments.filter((file) => !(file.parentType === parentType && file.parentId === parentId));
}

function sortPhases() {
  state.phases.sort((a, b) => Number(a.number) - Number(b.number));
  state.phases.forEach((phase, index) => (phase.number = index + 1));
}

function reorderById(collection, draggedId, targetId) {
  const from = collection.findIndex((item) => item.id === draggedId);
  const to = collection.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = collection.splice(from, 1);
  collection.splice(to, 0, item);
}

function reorderStrings(collection, dragged, target) {
  const from = collection.indexOf(dragged);
  const to = collection.indexOf(target);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = collection.splice(from, 1);
  collection.splice(to, 0, item);
}

function assignDraggedItem(kind, id, updates) {
  const map = { task: "tasks", event: "events", purchase: "purchases", file: "projectFiles" };
  const collection = state[map[kind]];
  if (!collection) return;
  const item = collection.find((entry) => entry.id === id);
  if (item) Object.assign(item, updates);
}

function parseDrag(event) {
  try {
    return JSON.parse(event.dataTransfer.getData("application/json"));
  } catch {
    return null;
  }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-no-card-click]")) return;

  if (event.target.dataset.backdrop !== undefined) {
    modal = null;
    render();
    return;
  }

  const target = event.target.closest("[data-action], [data-page]");
  if (!target) return;

  if (target.dataset.page) {
    page = target.dataset.page;
    selectedTasks.clear();
    render();
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "noop") return;
  if (action === "select-task") return;

  if (action === "close-modal") {
    modal = null;
    render();
    return;
  }

  if (action === "toggle-theme") state.theme = state.theme === "dark" ? "light" : "dark";
  if (action === "set-theme") state.theme = target.dataset.theme;
  if (action === "open-logo") modal = { type: "logo" };
  if (action === "task-modal") modal = { type: "task", id, phase: target.dataset.phase, date: target.dataset.date };
  if (action === "event-modal") modal = { type: "event", id, phase: target.dataset.phase };
  if (action === "date-tasks-modal") modal = { type: "dateTasks", date: target.dataset.date };
  if (action === "purchase-modal") modal = { type: "purchase", id };
  if (action === "file-modal") modal = { type: "file", id };
  if (action === "file-tabs-modal") modal = { type: "fileTabs" };
  if (action === "file-tab-modal") modal = { type: "fileTab", id };
  if (action === "member-modal") modal = { type: "member", id };
  if (action === "role-modal") modal = { type: "role", id };
  if (action === "phase-modal") modal = { type: "phase", id };
  if (action === "template-modal") modal = { type: "template" };
  if (action === "save-modal") await saveModal();

  if (action === "workflow-focus") {
    workflowView.focusId = id;
    workflowView.zoom = 1.08;
  }
  if (action === "workflow-reset") {
    workflowView.focusId = null;
    workflowView.zoom = 0.72;
  }
  if (action === "workflow-prev" || action === "workflow-next") {
    const index = state.phases.findIndex((phase) => phase.id === workflowView.focusId);
    const next = action === "workflow-prev" ? Math.max(0, index - 1) : Math.min(state.phases.length - 1, index + 1);
    workflowView.focusId = state.phases[next]?.id || state.phases[0]?.id || null;
    workflowView.zoom = 1.08;
  }

  if (action === "reset-template" && confirm("Restore the default phases only? Tasks, events, purchases, and files stay untouched.")) {
    state.phases = structuredClone(BASE_PHASES);
  }
  if (action === "restore-base-template") {
    state.phases = structuredClone(BASE_PHASES);
    modal = { type: "template" };
  }
  if (action === "delete-workflow-items" && confirm("Delete all tasks and events while keeping workflow phases?")) {
    state.tasks.forEach((task) => removeParentAttachments("task", task.id));
    state.events.forEach((item) => removeParentAttachments("event", item.id));
    state.tasks = [];
    state.events = [];
    selectedTasks.clear();
  }
  if (action === "delete-task") {
    state.tasks = state.tasks.filter((task) => task.id !== id);
    removeParentAttachments("task", id);
    modal = null;
  }
  if (action === "delete-event") {
    state.events = state.events.filter((item) => item.id !== id);
    removeParentAttachments("event", id);
    modal = null;
  }
  if (action === "delete-selected-tasks") {
    state.tasks = state.tasks.filter((task) => {
      if (selectedTasks.has(task.id)) removeParentAttachments("task", task.id);
      return !selectedTasks.has(task.id);
    });
    selectedTasks.clear();
  }
  if (action === "delete-all-tasks" && confirm("Delete all manually created tasks?")) {
    state.tasks.forEach((task) => removeParentAttachments("task", task.id));
    state.tasks = [];
    selectedTasks.clear();
  }
  if (action === "delete-date-tasks" && confirm("Remove all tasks on this date?")) {
    const date = target.dataset.date;
    state.tasks = state.tasks.filter((task) => {
      if (task.dueDate === date) removeParentAttachments("task", task.id);
      return task.dueDate !== date;
    });
    modal = { type: "dateTasks", date };
  }
  if (action === "delete-purchase") {
    state.purchases = state.purchases.filter((purchase) => purchase.id !== id);
    removeParentAttachments("purchase", id);
    modal = null;
  }
  if (action === "delete-member") {
    state.members = state.members.filter((member) => member.id !== id);
    state.tasks.forEach((task) => {
      if (task.assigneeId === id) task.assigneeId = "";
    });
    state.events.forEach((item) => {
      if (item.assigneeId === id) item.assigneeId = "";
    });
    state.purchases.forEach((purchase) => {
      if (purchase.purchaserId === id) purchase.purchaserId = "";
    });
    modal = null;
  }
  if (action === "delete-role") {
    state.roles = state.roles.filter((role) => role.id !== id);
    state.members.forEach((member) => {
      if (member.roleId === id) {
        member.roleId = "";
        member.role = "";
      }
    });
    state.tasks.forEach((task) => {
      if (task.roleId === id) task.roleId = "";
    });
    state.fileTabs.forEach((tab) => {
      if (tab.roleId === id) tab.roleId = "";
    });
    state.projectFiles.forEach((file) => {
      if (file.roleId === id) file.roleId = "";
    });
    if (filters.taskRole === id) filters.taskRole = "all";
    if (filters.fileRole === id) filters.fileRole = "all";
    modal = null;
  }
  if (action === "delete-file") {
    state.projectFiles = state.projectFiles.filter((file) => file.id !== id);
    modal = null;
  }
  if (action === "delete-attachment") state.attachments = state.attachments.filter((file) => file.id !== id);
  if (action === "clear-data" && confirm("Clear all local project data and restore the base workflow phases?")) {
    state = freshState();
    selectedTasks.clear();
  }
  if (action === "calendar-prev") calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + (filters.calendarView === "month" ? -1 : 0), calendarDate.getDate() + (filters.calendarView === "week" ? -7 : 0));
  if (action === "calendar-next") calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + (filters.calendarView === "month" ? 1 : 0), calendarDate.getDate() + (filters.calendarView === "week" ? 7 : 0));
  if (action === "calendar-view") filters.calendarView = target.dataset.view;
  if (action === "add-phase") {
    state.phases.push({ id: uid("phase"), number: state.phases.length + 1, title: "New Phase", description: "", roles: "", dependencies: "", progress: 0 });
    modal = { type: "template" };
  }
  if (action === "add-file-tab") modal = { type: "fileTab", id: "" };
  if (action === "delete-file-tab") {
    state.fileTabs = state.fileTabs.filter((tab) => tab.id !== id);
    state.projectFiles.forEach((file) => {
      if (file.tabId === id) file.tabId = "";
    });
    modal = { type: "fileTabs" };
  }
  if (action === "file-tab-up" || action === "file-tab-down") {
    const index = state.fileTabs.findIndex((tab) => tab.id === id);
    const next = action === "file-tab-up" ? index - 1 : index + 1;
    if (index >= 0 && next >= 0 && next < state.fileTabs.length) {
      [state.fileTabs[index], state.fileTabs[next]] = [state.fileTabs[next], state.fileTabs[index]];
    }
    modal = { type: "fileTabs" };
  }
  if (action === "delete-phase") {
    state.phases = state.phases.filter((phase) => phase.id !== id);
    sortPhases();
    modal = { type: "template" };
  }
  if (action === "phase-up" || action === "phase-down") {
    const index = state.phases.findIndex((phase) => phase.id === id);
    const next = action === "phase-up" ? index - 1 : index + 1;
    if (index >= 0 && next >= 0 && next < state.phases.length) {
      [state.phases[index], state.phases[next]] = [state.phases[next], state.phases[index]];
      state.phases.forEach((phase, phaseIndex) => (phase.number = phaseIndex + 1));
      modal = { type: "template" };
    }
  }

  saveState();
  render();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.filter) {
    filters[target.dataset.filter] = target.value;
    render();
  }
  if (target.dataset.action === "select-task") {
    target.checked ? selectedTasks.add(target.dataset.id) : selectedTasks.delete(target.dataset.id);
    render();
  }
  if (target.dataset.action === "scale") {
    state.scale = target.value;
    saveState();
    render();
  }
});

document.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[draggable='true'][data-drag-kind][data-drag-id]");
  if (!item) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", JSON.stringify({ kind: item.dataset.dragKind, id: item.dataset.dragId }));
});

document.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-drop-phase], [data-drop-date], [data-drop-file-tab]");
  if (!target) return;
  event.preventDefault();
  target.classList.add("drop-ready");
});

document.addEventListener("dragleave", (event) => {
  const target = event.target.closest("[data-drop-phase], [data-drop-date], [data-drop-file-tab]");
  if (target) target.classList.remove("drop-ready");
});

document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-drop-phase], [data-drop-date], [data-drop-file-tab]");
  if (!target) return;
  event.preventDefault();
  target.classList.remove("drop-ready");
  const drag = parseDrag(event);
  if (!drag) return;

  if (target.dataset.dropPhase !== undefined) {
    const phaseId = target.dataset.dropPhase;
    if (drag.kind === "phase") {
      reorderById(state.phases, drag.id, phaseId);
      state.phases.forEach((phase, index) => (phase.number = index + 1));
    } else if (["task", "event", "purchase"].includes(drag.kind)) {
      assignDraggedItem(drag.kind, drag.id, { phaseId });
    }
  }

  if (target.dataset.dropDate !== undefined && ["task", "event", "purchase"].includes(drag.kind)) {
    const date = target.dataset.dropDate;
    assignDraggedItem(drag.kind, drag.id, drag.kind === "task" ? { dueDate: date } : { date });
  }

  if (target.dataset.dropFileTab !== undefined && drag.kind === "file") {
    const tab = getFileTab(target.dataset.dropFileTab);
    assignDraggedItem("file", drag.id, { tabId: target.dataset.dropFileTab, roleId: tab?.roleId || "" });
  }

  if (target.dataset.dropFileTab !== undefined && drag.kind === "file-tab") {
    reorderById(state.fileTabs, drag.id, target.dataset.dropFileTab);
    modal = { type: "fileTabs" };
  }

  saveState();
  render();
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (modal) saveModal();
});

document.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".clickable-card[data-action]");
  if (!card || event.target.matches("input, textarea, select, button, a")) return;
  event.preventDefault();
  card.click();
});

render();
