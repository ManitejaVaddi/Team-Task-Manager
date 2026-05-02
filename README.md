# Team Task Manager

The main purpose of this application is to manage projects, assign tasks to team members, and track progress in a structured way. Instead of using scattered communication tools, everything is handled in one centralized system.

In this application, users can sign up and log in securely. Based on their role, they get different permissions. Admin users can create projects, add team members, and assign tasks, while members can view their assigned tasks and update their status.

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

