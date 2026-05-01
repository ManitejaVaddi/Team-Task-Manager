const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  view: "dashboard",
  data: { stats: null, recent: [], projects: [], tasks: [], users: [] }
};

const app = document.querySelector("#app");

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
};

function setSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", payload.token);
  localStorage.setItem("ttm_user", JSON.stringify(payload.user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
  render();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function icon(name) {
  const icons = {
    dashboard: "M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-11h7V4h-7v5Z",
    projects: "M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2H18.5A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-9Z",
    tasks: "M5 5h14v2H5V5Zm0 6h14v2H5v-2Zm0 6h9v2H5v-2Z",
    team: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19a5 5 0 0 1 10 0H3Zm10.5 0a6.5 6.5 0 0 0-1.1-3.6A4.5 4.5 0 0 1 21 19h-7.5Z",
    plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z",
    logout: "M10 4h8v16h-8v-2h6V6h-6V4Zm-1 4 1.4 1.4L7.8 12l2.6 2.6L9 16l-5-4 5-4Z"
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
}

async function loadData() {
  const [dashboard, projects, tasks, users] = await Promise.all([
    api("/api/dashboard"),
    api("/api/projects"),
    api("/api/tasks"),
    api("/api/users")
  ]);
  state.data = { ...dashboard, projects: projects.projects, tasks: tasks.tasks, users: users.users };
}

function statusClass(status) {
  return status === "Done" ? "done" : status === "In Progress" ? "progress" : "todo";
}

function priorityClass(priority) {
  return priority.toLowerCase();
}

function isOverdue(task) {
  return task.status !== "Done" && task.dueDate < new Date().toISOString().slice(0, 10);
}

function authScreen(mode = "login", message = "") {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-art">
        <div class="brand"><span class="logo">TT</span><span>TeamTask</span></div>
        <div>
          <h1>Plan projects, assign work, and see progress clearly.</h1>
          <p>A full-stack team task manager with authentication, project membership, task ownership, deadlines, dashboard stats, and admin/member access.</p>
          <div class="auth-preview">
            <div class="preview-row"><span class="dot blue"></span><strong>Mobile App Redesign</strong><span class="pill progress">In Progress</span></div>
            <div class="preview-row"><span class="dot amber"></span><strong>API Validation</strong><span class="pill todo">Todo</span></div>
            <div class="preview-row"><span class="dot green"></span><strong>Launch QA</strong><span class="pill done">Done</span></div>
          </div>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="tabs">
            <button class="${mode === "login" ? "active" : ""}" data-auth-mode="login">Login</button>
            <button class="${mode === "signup" ? "active" : ""}" data-auth-mode="signup">Signup</button>
          </div>
          <form id="authForm">
            ${mode === "signup" ? `
              <div class="field"><label>Name</label><input name="name" required placeholder="Your name"></div>
            ` : ""}
            <div class="field"><label>Email</label><input name="email" type="email" required placeholder="you@example.com"></div>
            <div class="field"><label>Password</label><input name="password" type="password" required minlength="6" placeholder="Minimum 6 characters"></div>
            ${mode === "signup" ? `
              <div class="field"><label>Role</label><select name="role"><option>Member</option><option>Admin</option></select></div>
            ` : ""}
            <button class="btn primary full">${mode === "login" ? "Login" : "Create account"}</button>
            <p class="notice">${escapeHtml(message)}</p>
          </form>
        </div>
      </section>
    </main>
  `;

  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => authScreen(button.dataset.authMode));
  });

  document.querySelector("#authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    try {
      const payload = await api(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      setSession(payload);
      await loadData();
      render();
    } catch (error) {
      authScreen(mode, error.message);
    }
  });
}

function layout(content) {
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["projects", "Projects", "projects"],
    ["tasks", "Tasks", "tasks"],
    ["team", "Team", "team"]
  ];

  app.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="logo">TT</span><span>TeamTask</span></div>
        <nav class="nav">
          ${nav.map(([key, label, iconName]) => `<button class="${state.view === key ? "active" : ""}" data-view="${key}">${icon(iconName)} ${label}</button>`).join("")}
        </nav>
        <div class="user-box">
          <div><strong>${escapeHtml(state.user.name)}</strong><br><small>${escapeHtml(state.user.email)}</small></div>
          <span class="pill role">${state.user.role}</span>
          <button class="btn ghost" id="logoutBtn">${icon("logout")} Logout</button>
        </div>
      </aside>
      <section class="main">${content}</section>
    </main>
  `;

  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      await refresh();
    });
  });
  document.querySelector("#logoutBtn").addEventListener("click", logout);
}

function taskTable(tasks) {
  if (!tasks.length) return `<div class="empty">No tasks found.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Task</th><th>Project</th><th>Assignee</th><th>Due</th><th>Status</th><th>Priority</th><th>Action</th></tr></thead>
        <tbody>
          ${tasks.map(task => `
            <tr>
              <td><div class="task-title">${escapeHtml(task.title)}</div><div class="muted">${escapeHtml(task.description)}</div></td>
              <td>${escapeHtml(task.projectName)}</td>
              <td>${escapeHtml(task.assigneeName)}</td>
              <td>${escapeHtml(task.dueDate)} ${isOverdue(task) ? `<span class="pill overdue">Overdue</span>` : ""}</td>
              <td><span class="pill ${statusClass(task.status)}">${escapeHtml(task.status)}</span></td>
              <td><span class="pill ${priorityClass(task.priority)}">${escapeHtml(task.priority)}</span></td>
              <td>
                <select class="status-select" data-task-status="${task.id}">
                  ${["Todo", "In Progress", "Done"].map(status => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
                </select>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function dashboardView() {
  const stats = state.data.stats || { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  layout(`
    <div class="topbar">
      <div><h1>Dashboard</h1><p>${state.user.role === "Admin" ? "All team activity at a glance." : "Your assigned workload and deadlines."}</p></div>
    </div>
    <div class="grid stats">
      <div class="stat"><span>Total</span><strong>${stats.total}</strong></div>
      <div class="stat"><span>Todo</span><strong>${stats.todo}</strong></div>
      <div class="stat"><span>In Progress</span><strong>${stats.inProgress}</strong></div>
      <div class="stat"><span>Done</span><strong>${stats.done}</strong></div>
      <div class="stat"><span>Overdue</span><strong>${stats.overdue}</strong></div>
    </div>
    <br>
    <div class="card">
      <h2>Recent Tasks</h2>
      ${taskTable(state.data.recent)}
    </div>
  `);
  bindTaskStatus();
}

function projectView() {
  const adminForm = state.user.role === "Admin" ? `
    <div class="card">
      <h2>Create Project</h2>
      <form id="projectForm">
        <div class="field"><label>Project name</label><input name="name" required placeholder="Website Launch"></div>
        <div class="field"><label>Description</label><textarea name="description" placeholder="Project goals and context"></textarea></div>
        <button class="btn primary">${icon("plus")} Create</button>
      </form>
    </div>
    <div class="card">
      <h2>Add Member</h2>
      <form id="memberForm" class="form-grid">
        <div class="field"><label>Project</label><select name="projectId" required>${state.data.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>User</label><select name="userId" required>${state.data.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`).join("")}</select></div>
        <button class="btn primary span-2">${icon("plus")} Add member</button>
      </form>
    </div>
  ` : "";

  layout(`
    <div class="topbar"><div><h1>Projects</h1><p>Manage project spaces and team membership.</p></div></div>
    <div class="grid two-col">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Project</th><th>Owner</th><th>Members</th><th>Tasks</th><th>Created</th></tr></thead>
          <tbody>
            ${state.data.projects.map(project => `
              <tr>
                <td><strong>${escapeHtml(project.name)}</strong><div class="muted">${escapeHtml(project.description)}</div></td>
                <td>${escapeHtml(project.owner_name)}</td>
                <td>${project.member_count}</td>
                <td>${project.task_count}</td>
                <td>${escapeHtml(project.created_at?.slice(0, 10))}</td>
              </tr>
            `).join("") || `<tr><td colspan="5"><div class="empty">No projects yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="grid">${adminForm || `<div class="card"><h2>Member Access</h2><p class="muted">Members can view assigned project work and update their own task statuses.</p></div>`}</div>
    </div>
  `);

  document.querySelector("#projectForm")?.addEventListener("submit", submitProject);
  document.querySelector("#memberForm")?.addEventListener("submit", submitMember);
}

function tasksView() {
  const adminForm = state.user.role === "Admin" ? `
    <div class="card">
      <h2>Create Task</h2>
      <form id="taskForm" class="form-grid">
        <div class="field span-2"><label>Title</label><input name="title" required placeholder="Prepare launch checklist"></div>
        <div class="field span-2"><label>Description</label><textarea name="description" placeholder="What needs to be done?"></textarea></div>
        <div class="field"><label>Project</label><select name="projectId" required>${state.data.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Assignee</label><select name="assigneeId" required>${state.data.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Due date</label><input name="dueDate" type="date" required></div>
        <div class="field"><label>Priority</label><select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
        <button class="btn primary span-2">${icon("plus")} Create task</button>
      </form>
    </div>
  ` : "";

  layout(`
    <div class="topbar"><div><h1>Tasks</h1><p>Create, assign, and track task status.</p></div></div>
    <div class="grid two-col">
      ${taskTable(state.data.tasks)}
      <div>${adminForm || `<div class="card"><h2>Status Updates</h2><p class="muted">Use the status menu on your assigned tasks to keep progress current.</p></div>`}</div>
    </div>
  `);
  document.querySelector("#taskForm")?.addEventListener("submit", submitTask);
  bindTaskStatus();
}

function teamView() {
  layout(`
    <div class="topbar"><div><h1>Team</h1><p>Users and their platform roles.</p></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>
          ${state.data.users.map(user => `
            <tr>
              <td><strong>${escapeHtml(user.name)}</strong></td>
              <td>${escapeHtml(user.email)}</td>
              <td><span class="pill role">${escapeHtml(user.role)}</span></td>
              <td>${escapeHtml(user.createdAt?.slice(0, 10))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

async function submitProject(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  await api("/api/projects", { method: "POST", body: JSON.stringify(form) });
  await refresh();
}

async function submitMember(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  await api(`/api/projects/${form.projectId}/members`, { method: "POST", body: JSON.stringify({ userId: form.userId }) });
  await refresh();
}

async function submitTask(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target).entries());
  await api("/api/tasks", { method: "POST", body: JSON.stringify(form) });
  await refresh();
}

function bindTaskStatus() {
  document.querySelectorAll("[data-task-status]").forEach(select => {
    select.addEventListener("change", async () => {
      try {
        await api(`/api/tasks/${select.dataset.taskStatus}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: select.value })
        });
        await refresh();
      } catch (error) {
        alert(error.message);
        await refresh();
      }
    });
  });
}

async function refresh() {
  try {
    await loadData();
    render();
  } catch (error) {
    if (error.message.includes("authentication")) logout();
    else alert(error.message);
  }
}

function render() {
  if (!state.token || !state.user) return authScreen();
  if (state.view === "projects") return projectView();
  if (state.view === "tasks") return tasksView();
  if (state.view === "team") return teamView();
  return dashboardView();
}

(async function boot() {
  if (state.token) {
    try {
      const me = await api("/api/me");
      state.user = me.user;
      localStorage.setItem("ttm_user", JSON.stringify(me.user));
      await loadData();
    } catch {
      logout();
      return;
    }
  }
  render();
})();
