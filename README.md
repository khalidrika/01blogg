# 01Blog

A social blogging application for students to share their learning journey. The Angular client communicates with the Spring Boot backend through REST APIs; PostgreSQL stores accounts, posts and social relationships.

## Features

- Register and log in, with BCrypt passwords, signed JWTs and user/admin permissions.
- Discover profiles, follow/unfollow users and read a feed of followed authors.
- Create, edit and delete your own posts, with optional image/video uploads and previews.
- Like/unlike posts and add/delete your own comments; refresh comments to see new replies.
- Receive notifications when followed authors publish; mark them read or unread. The navigation badge refreshes every 30 seconds.
- Report a profile with a reason and confirmation. Only administrators can read reports.
- Admin dashboard for users, posts and reports, with confirmation before bans, unbans and deletions.
- Responsive Bootstrap navigation and forms, loading/error feedback and invalid-route pages.

The original assignment is preserved in [docs/project-subject.md](docs/project-subject.md).

## Technologies and prerequisites

| Area | Technologies |
| --- | --- |
| Backend | Java 21, Spring Boot 4.0.8, Spring Security, Spring Data JPA/Hibernate, Bean Validation, JJWT |
| Database | PostgreSQL 17, Docker Compose for local development |
| Frontend | Angular 22, TypeScript 6, RxJS, Bootstrap 5.3.8 |
| Verification | JUnit/Mockito/MockMvc, Vitest, Playwright with Google Chrome |

Install Java 21, Node.js 24 with npm, and Docker with Compose. The Maven wrapper is included. Python 3 and Google Chrome are also required for the complete verification script. Initial Maven/npm installation requires internet access.

## Local setup

Run these commands from the repository root unless a different directory is specified.

### 1. Configure the environment

```bash
cp .env.example .env
openssl rand -hex 32
```

Edit `.env`: set `DB_PASSWORD` and paste the generated value into `JWT_SECRET`. The secret must contain at least 32 bytes. Keep plain `KEY=value` entries, without shell expressions or surrounding quotes; the backend reads this as a properties file. `.env` is ignored by Git.

To create an administrator on the next startup, also set:

```properties
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=your-own-strong-password
```

Choose your own password with at least 12 characters and at most 72 UTF-8 bytes. Leave the email/password blank to skip administrator creation. There is no default administrator password. Existing accounts are never promoted or reset by these settings. Remove the bootstrap password after creating the account.

| Variable | Default / purpose |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/postgres` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | Required; must match PostgreSQL |
| `JWT_SECRET` | Required; signing key |
| `UPLOAD_DIR` | `uploads`, relative to the backend working directory |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200`; comma-separated origins if needed |
| `BOOTSTRAP_ADMIN_*` | Optional first administrator creation |

**Existing installations:** keep the database password matching the existing Docker volume. Changing `.env` does not change an already initialized PostgreSQL password. Back up existing data before schema upgrades; Hibernate currently uses `ddl-auto=update`. The user table now requires unique emails and usernames, and post content allows up to 10,000 characters. Resolve existing duplicate accounts before applying those uniqueness constraints. Tokens issued before account-ID binding was added require a fresh login.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

The container is named `blog-postgres`, stores data in the `postgres_data` volume and publishes PostgreSQL on `127.0.0.1:5432`.

### 3. Start the backend

In a terminal:

```bash
cd backend
./mvnw spring-boot:run
```

The API runs at `http://localhost:8080/api`. Run from `backend/` so the default upload directory and root `.env` resolve consistently. Environment variables override `.env` values. Do not enable Spring debug logging with real credentials.

### 4. Start the frontend

In another terminal:

```bash
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`, register, then log in. Use two accounts in separate browsers/private windows to demonstrate subscriptions and interactions. The feed contains posts from followed authors; your own posts are available through **My Posts** or **My Profile**.

The normal API URL is in `frontend/src/environments/environment.ts`. If changing ports or hosts, update this URL and the backend's allowed CORS origins together.

## Project structure

```text
backend/src/main/java/com/blog/backend/
  config/       Security filter, CORS and optional administrator initialization
  controllers/  HTTP endpoints
  services/     Business rules, transactions, JWT and media storage
  repository/   JPA persistence
  entity/       Relational model
  dto/          Request validation and response shapes
  exception/    Consistent HTTP errors
backend/src/test/              Backend tests
frontend/src/app/
  core/         Authentication, guards, interceptor and API services
  pages/        Feed, profiles, editor, notifications and administration
  discover-users/             Profile discovery
  shared/       Navigation, post interactions and delete confirmation
frontend/src/environments/    Normal and isolated test API URLs
frontend/e2e/                 Real-browser workflows
scripts/verify.py             Complete isolated verification
```

## API and access rules

| Endpoints | Access |
| --- | --- |
| `POST /api/register`, `POST /api/login` | Public |
| `GET /uploads/{filename}` | Public media, including byte-range requests |
| `/api/posts`, `/api/posts/feed`, `/api/users/**` | Authenticated users |
| `PUT/DELETE /api/posts/{id}` | Post owner |
| `GET/PUT/DELETE /api/posts/{id}/likes` | Authenticated users; PUT/DELETE are idempotent |
| `GET/POST /api/posts/{id}/comments` | Authenticated users |
| `DELETE /api/posts/comments/{id}` | Comment owner |
| `GET/PUT/DELETE /api/users/{id}/follow` | Authenticated users; self-follow is rejected |
| `POST /api/users/{id}/report` | Authenticated users; self-report is rejected |
| `/api/notifications/**` | Only the notification recipient can modify it |
| `/api/admin/users`, `/api/admin/posts`, `/api/admin/reports` | Admin only |
| `/api/admin/users/{id}/ban`, `/unban`, deletion routes | Admin only; administrator accounts cannot be moderated |

Authorization is enforced on the server, in addition to Angular route guards and hidden admin navigation. Role and ban status are read from the database on each authenticated request. JWTs expire after 10 hours and bind both email and account ID, so deleting and recreating an email cannot revive the old account's token. The browser stores tokens in `localStorage`; logout clears the local session, but does not revoke an already copied JWT before expiry. HTTPS and protection against script injection remain essential for deployment.

## Media and validation

- Accepted uploads: PNG, JPG/JPEG and MP4; maximum 50 MiB per file. Title/content are required, with limits of 255 and 10,000 characters. Comments and report reasons are limited to 255 characters.
- Filename extension and declared MIME must agree. Images are decoded and limited to 20 million pixels. MP4 validation checks container boundaries, branding, a video track and media payload; it is not codec decoding, transcoding or malware scanning.
- Files use generated UUID names. Path traversal and symlinks are rejected. Media responses specify the content type, `nosniff` and a restrictive content security policy.
- Original accepted bytes are preserved. Video playback also depends on the browser supporting the uploaded codec.
- Database changes and notifications share a transaction. New media is cleaned up on rollback; replaced/deleted media is removed only after commit. A filesystem cleanup failure is logged for manual retry.
- Uploads are publicly retrievable by their URL, appropriate for shared posts. Store the upload directory outside executable application assets and preserve it alongside database backups.
- JPA uses bound parameters. Angular renders user text through interpolation, without rendering arbitrary HTML. Passwords are hashed, never returned by APIs, and checked against BCrypt's 72-byte limit. Unique database constraints prevent duplicate email/username registrations, including concurrent requests.

## Tests and production build

Frontend unit tests and production bundle:

```bash
cd frontend
npm test -- --watch=false
npm run build
```

The browser bundle is written to `frontend/dist/frontend/browser`. A deployment server must return `index.html` for Angular routes. Configure HTTPS, the API URL, CORS and persistent database/media storage for the deployment environment.

Backend unit/security tests without a running database:

```bash
cd backend
./mvnw '-Dtest=*Test' test
```

The full `./mvnw test` also starts the application context and needs PostgreSQL. Use an isolated database for this, or use the complete verification script below.

### Complete verification

With PostgreSQL running, frontend dependencies installed and Google Chrome installed:

```bash
python3 scripts/verify.py
```

This script creates a randomly named temporary database in `blog-postgres`, uses a temporary upload directory, runs all backend/frontend tests and the production build, then starts isolated servers on **8081/4201** and runs Playwright. It creates its own test administrator. It stops its servers and deletes only its generated test database/uploads afterward. Ports 8081/4201 must be free. Your normal database and uploaded media are not used.

Set `DOCKER_BIN` or `POSTGRES_CONTAINER` if the Docker executable/container name differs. The runner assumes the supplied Compose database is exposed on localhost:5432. Logs remain in `.verification/`; Playwright screenshots/traces are in `frontend/test-results/`.

The browser scenarios cover separate user sessions, registration, following, PNG/MP4 previews and byte integrity, video playback/ranges, editing, likes, comments and deletion, notifications, reporting, admin confirmation/ban/unban/removal, permission failures, concurrent duplicate requests, mobile layout and HTML displayed safely as text. They check browser errors during normal flows. This is functional verification, not a load test or a complete security audit.

To run Playwright manually against prepared isolated servers, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` to an admin in that **test** database and run `npm run test:e2e` from `frontend/`. The tests create and delete fixture accounts/posts; use the isolated configuration, not a production database.

## Demo checklist and scope

See [docs/evaluation.md](docs/evaluation.md) for a walkthrough matching the assignment. Optional bonuses such as WebSockets, infinite scrolling, dark mode, analytics and Markdown rendering are not implemented. Notifications use polling and comments have a refresh button. Reports target profiles; moderators can remove their posts through the dashboard. Before production, add deployment-specific monitoring, backups, rate limiting and managed schema migrations.
