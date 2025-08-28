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

## License & contact

- Add a LICENSE file at the repository root if you want to set an explicit license.
- For questions about the codebase, open an issue or contact the repository owner.

---


