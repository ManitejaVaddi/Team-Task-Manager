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
git clone https://github.com/ManitejaVaddi/Team-Task-Manager
cd team-task-manager
```

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Live Demo

Live URL: https://team-task-manager-production-8d6c.up.railway.app

## Demo Notes

The first signup becomes an Admin automatically. Later signups can be Member or Admin for demo purposes.

Recommended demo flow:

- Signup as Admin
- Create a project
- Signup or login as a Member
- Add the Member to the project
- Create and assign a task
- Update task status
- Check the dashboard

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

## Deployment

This app is deployed on Railway. The production server uses:

```bash
npm start
```

Required environment variable:

```text
JWT_SECRET=your-long-random-secret
```

