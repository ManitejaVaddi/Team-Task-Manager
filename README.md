# Team Task Manager

A full-stack web app for creating projects, assigning tasks, tracking status, and managing role-based access for Admin and Member users.

## Features

- Signup and login with password hashing
- Admin and Member roles
- Project creation and project membership
- Task creation, assignment, priority, due date, and status tracking
- Dashboard with total, todo, in-progress, done, and overdue task counts
- REST API backed by SQLite relationships
- Railway-ready `npm start` deployment

## Tech Stack

- Node.js HTTP server
- Built-in `node:sqlite` database
- HTML, CSS, and JavaScript frontend
- PBKDF2 password hashing and signed JWT-style auth tokens

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Live Demo

Live URL: team-task-manager-production-8d6c.up.railway.app


The first signup becomes an Admin automatically. Later signups can be Member or Admin for demo purposes.

## API Routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/users`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/members`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/status`
- `GET /api/dashboard`


