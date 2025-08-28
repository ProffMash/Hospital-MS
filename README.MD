# Hospital Management System (Hospital-MS)

A full-stack Hospital Management System for managing patients, appointments, diagnoses, laboratory orders/results, pharmacy inventory and sales, and staff — provided as a monorepo with a React + TypeScript frontend and a Django (Python) backend.

## What it does

- Patient registration and management
- Appointment booking and scheduling
- Recording diagnoses and linking them to patients and staff
- Laboratory order creation and lab result recording
- Pharmacy inventory, medicine sales, and sales records
- Staff management and authentication
- REST API backend consumed by a modern web frontend

## Repository layout

- `/client` — Frontend application built with Vite + React + TypeScript
- `/server` — Django backend (Django project and `hms` app) with API endpoints and database (SQLite used in development)
- `db.sqlite3` — Development SQLite database (backend)

## Tech stack

Frontend
- React
- TypeScript
- Vite (dev tooling / bundler)
- Tailwind CSS (utility-first styling)
- pnpm (package manager)
- ESLint / TypeScript tooling

Backend
- Python (3.11 in the workspace cache; project tested with Python 3.11+)
- Django (REST API served by Django; serializers and views live in `server/hms`)
- SQLite (development DB)
- Django REST Framework 

Development tooling
- Git for source control
- Optional: VS Code (recommended)

## Live demo

A live deployment of the frontend is available at:

- https://hospital-ms-alpha.vercel.app

This is a preview deployment and may be hosted on a free tier — see the tester note below about a possible cold-start delay on first login.

## Quick start — prerequisites

- Node.js (LTS) and pnpm
- Python 3.11+ and pip
- (Optional) virtualenv or venv

## Run the frontend (client)

Open a terminal, then:

```powershell
cd client
pnpm install
pnpm run dev
```

- The client is a Vite app and will open on a local port (usually `http://localhost:5173`).
- If the client expects an API base URL, set the Vite env var `VITE_API_URL` before running (example below).

## Run the backend (server)

Open a terminal, then:

```powershell
cd server
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt  # if present
# If there is no requirements.txt, install at minimum:
# pip install Django djangorestframework
python manage.py migrate
python manage.py createsuperuser  # optional: create admin account
python manage.py runserver
```

The backend will start on `http://127.0.0.1:8000` by default. API endpoints are served from the Django project; the client is expected to call those endpoints.


## Project structure (high level)

- client/
  - src/
    - Api/ (API client wrappers)
    - components/ (React UI components and routes)
    - pages/ (app pages: Appointments, Patients, Dashboard, etc.)
    - store/ (local state stores)

- server/
  - manage.py
  - <django project files> (settings, urls, wsgi, asgi)
  - hms/ (Django app with models, serializers, views, urls)

## Contributing

- Fork the repo, create a feature branch, make changes, add tests where appropriate, and open a pull request.
- Keep frontend and backend changes scoped to their respective folders.
 - Fork the repo, create a feature branch, make changes, add tests where appropriate, and open a pull request.
 - Keep frontend and backend changes scoped to their respective folders.

Note for testers: on the first sign-in after the backend is idle the database (free-tier hosting) may cold-start. Expect the first login request to take up to ~50 seconds — please wait rather than retrying immediately. Subsequent requests should be fast.

## Test accounts / Pre-seeded logins

The project includes a few pre-seeded accounts you can use for manual testing in the frontend UI (email/password):

- Admin Dashboard
  - email: admin@gmail.com
  - password: password

- Doctor Dashboard
  - email: doc@gmail.com
  - password: password

- Pharmacy Dashboard
  - email: pharm@gmail.com
  - password: password






