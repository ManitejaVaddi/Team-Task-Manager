const http = require("node:http");
const { readFileSync, existsSync, mkdirSync } = require("node:fs");
const { join, extname } = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, "task-manager.db");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-on-railway";

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Admin', 'Member')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id, user_id),
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('Todo', 'In Progress', 'Done')) DEFAULT 'Todo',
  priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  due_date TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  assignee_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
`);

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashPassword(password, salt).split(":")[1]));
}

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function signToken(user) {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
  });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  return db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(data.sub) || null;
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (!body[field] || String(body[field]).trim() === "") return `${field} is required`;
  }
  return null;
}

function clean(value) {
  return String(value || "").trim();
}

function isAdmin(user) {
  return user && user.role === "Admin";
}

function canAccessProject(user, projectId) {
  if (isAdmin(user)) return true;
  return Boolean(db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?").get(projectId, user.id));
}

function taskRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    projectId: row.project_id,
    projectName: row.project_name,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function handleApi(req, res, path) {
  const authHeader = req.headers.authorization || "";
  const user = verifyToken(authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
  const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await parseBody(req) : {};

  if (path === "/api/auth/signup" && req.method === "POST") {
    const missing = requireFields(body, ["name", "email", "password"]);
    if (missing) return json(res, 400, { message: missing });
    if (String(body.password).length < 6) return json(res, 400, { message: "password must be at least 6 characters" });
    const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    const role = count === 0 ? "Admin" : body.role === "Admin" ? "Admin" : "Member";
    try {
      const info = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run(
        clean(body.name),
        clean(body.email).toLowerCase(),
        hashPassword(String(body.password)),
        role
      );
      const created = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(info.lastInsertRowid);
      return json(res, 201, { token: signToken(created), user: created });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return json(res, 409, { message: "email already exists" });
      throw error;
    }
  }

  if (path === "/api/auth/login" && req.method === "POST") {
    const missing = requireFields(body, ["email", "password"]);
    if (missing) return json(res, 400, { message: missing });
    const found = db.prepare("SELECT * FROM users WHERE email = ?").get(clean(body.email).toLowerCase());
    if (!found || !verifyPassword(String(body.password), found.password_hash)) return json(res, 401, { message: "invalid email or password" });
    const safe = { id: found.id, name: found.name, email: found.email, role: found.role };
    return json(res, 200, { token: signToken(safe), user: safe });
  }

  if (!user) return json(res, 401, { message: "authentication required" });

  if (path === "/api/me" && req.method === "GET") return json(res, 200, { user });

  if (path === "/api/users" && req.method === "GET") {
    const users = db.prepare("SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY name").all();
    return json(res, 200, { users });
  }

  if (path === "/api/projects" && req.method === "GET") {
    const projects = isAdmin(user)
      ? db.prepare(`
          SELECT p.*, u.name AS owner_name, COUNT(DISTINCT pm.user_id) AS member_count, COUNT(DISTINCT t.id) AS task_count
          FROM projects p
          JOIN users u ON u.id = p.owner_id
          LEFT JOIN project_members pm ON pm.project_id = p.id
          LEFT JOIN tasks t ON t.project_id = p.id
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `).all()
      : db.prepare(`
          SELECT p.*, u.name AS owner_name, COUNT(DISTINCT pm2.user_id) AS member_count, COUNT(DISTINCT t.id) AS task_count
          FROM projects p
          JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
          JOIN users u ON u.id = p.owner_id
          LEFT JOIN project_members pm2 ON pm2.project_id = p.id
          LEFT JOIN tasks t ON t.project_id = p.id
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `).all(user.id);
    return json(res, 200, { projects });
  }

  if (path === "/api/projects" && req.method === "POST") {
    if (!isAdmin(user)) return json(res, 403, { message: "admin access required" });
    const missing = requireFields(body, ["name"]);
    if (missing) return json(res, 400, { message: missing });
    const info = db.prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)").run(clean(body.name), clean(body.description), user.id);
    db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)").run(info.lastInsertRowid, user.id);
    return json(res, 201, { project: db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid) });
  }

  const projectMemberMatch = path.match(/^\/api\/projects\/(\d+)\/members$/);
  if (projectMemberMatch && req.method === "POST") {
    if (!isAdmin(user)) return json(res, 403, { message: "admin access required" });
    const projectId = Number(projectMemberMatch[1]);
    const missing = requireFields(body, ["userId"]);
    if (missing) return json(res, 400, { message: missing });
    if (!db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId)) return json(res, 404, { message: "project not found" });
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(Number(body.userId))) return json(res, 404, { message: "user not found" });
    db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)").run(projectId, Number(body.userId));
    return json(res, 200, { message: "member added" });
  }

  const projectDetailMatch = path.match(/^\/api\/projects\/(\d+)$/);
  if (projectDetailMatch && req.method === "GET") {
    const projectId = Number(projectDetailMatch[1]);
    if (!canAccessProject(user, projectId)) return json(res, 403, { message: "project access denied" });
    const project = db.prepare("SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?").get(projectId);
    if (!project) return json(res, 404, { message: "project not found" });
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY u.name
    `).all(projectId);
    return json(res, 200, { project, members });
  }

  if (path === "/api/tasks" && req.method === "GET") {
    const tasks = (isAdmin(user)
      ? db.prepare(`
          SELECT t.*, p.name AS project_name, u.name AS assignee_name
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          JOIN users u ON u.id = t.assignee_id
          ORDER BY t.due_date ASC
        `).all()
      : db.prepare(`
          SELECT t.*, p.name AS project_name, u.name AS assignee_name
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
          JOIN users u ON u.id = t.assignee_id
          WHERE t.assignee_id = ? OR pm.user_id = ?
          ORDER BY t.due_date ASC
        `).all(user.id, user.id, user.id)).map(taskRow);
    return json(res, 200, { tasks });
  }

  if (path === "/api/tasks" && req.method === "POST") {
    if (!isAdmin(user)) return json(res, 403, { message: "admin access required" });
    const missing = requireFields(body, ["title", "projectId", "assigneeId", "dueDate"]);
    if (missing) return json(res, 400, { message: missing });
    const projectId = Number(body.projectId);
    const assigneeId = Number(body.assigneeId);
    if (!db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId)) return json(res, 404, { message: "project not found" });
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(assigneeId)) return json(res, 404, { message: "assignee not found" });
    db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)").run(projectId, assigneeId);
    const info = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date, project_id, assignee_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clean(body.title),
      clean(body.description),
      ["Todo", "In Progress", "Done"].includes(body.status) ? body.status : "Todo",
      ["Low", "Medium", "High"].includes(body.priority) ? body.priority : "Medium",
      clean(body.dueDate),
      projectId,
      assigneeId,
      user.id
    );
    return json(res, 201, { task: db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid) });
  }

  const taskStatusMatch = path.match(/^\/api\/tasks\/(\d+)\/status$/);
  if (taskStatusMatch && req.method === "PATCH") {
    const taskId = Number(taskStatusMatch[1]);
    if (!["Todo", "In Progress", "Done"].includes(body.status)) return json(res, 400, { message: "invalid status" });
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
    if (!task) return json(res, 404, { message: "task not found" });
    if (!isAdmin(user) && task.assignee_id !== user.id) return json(res, 403, { message: "only admins or assignees can update status" });
    db.prepare("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.status, taskId);
    return json(res, 200, { message: "status updated" });
  }

  if (path === "/api/dashboard" && req.method === "GET") {
    const tasks = (isAdmin(user)
      ? db.prepare("SELECT * FROM tasks").all()
      : db.prepare("SELECT * FROM tasks WHERE assignee_id = ?").all(user.id));
    const today = new Date().toISOString().slice(0, 10);
    const stats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === "Todo").length,
      inProgress: tasks.filter(t => t.status === "In Progress").length,
      done: tasks.filter(t => t.status === "Done").length,
      overdue: tasks.filter(t => t.status !== "Done" && t.due_date < today).length
    };
    const recent = db.prepare(`
      SELECT t.*, p.name AS project_name, u.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = t.assignee_id
      ${isAdmin(user) ? "" : "WHERE t.assignee_id = ?"}
      ORDER BY t.updated_at DESC
      LIMIT 6
    `);
    return json(res, 200, { stats, recent: (isAdmin(user) ? recent.all() : recent.all(user.id)).map(taskRow) });
  }

  return json(res, 404, { message: "API route not found" });
}

function serveStatic(req, res, pathname) {
  const publicDir = join(__dirname, "public");
  const filePath = pathname === "/" ? join(publicDir, "index.html") : join(publicDir, pathname);
  const safePath = filePath.startsWith(publicDir) ? filePath : join(publicDir, "index.html");
  const target = existsSync(safePath) ? safePath : join(publicDir, "index.html");
  const type = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml"
  }[extname(target)] || "text/plain";
  res.writeHead(200, { "Content-Type": type });
  res.end(readFileSync(target));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    return serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    return json(res, 500, { message: error.message || "server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Team Task Manager running on http://localhost:${PORT}`);
});
