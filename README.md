# EzehLabs portfolio and client API

The public portfolio is served by the same Express application as the client API. The first backend phase includes email-verified client accounts, persistent sessions, client IDs, client-owned project proposals, and administrator proposal/client management. Payments, realtime chat/calls, file uploads, and notification integrations are not part of this phase.

## Requirements

- Node.js 20 or newer
- Docker Desktop for the local PostgreSQL option, or an existing PostgreSQL database
- SMTP credentials to deliver account-verification emails

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `APP_ORIGIN`.
2. Start the local database with `docker compose up -d db`, or point `DATABASE_URL` at PostgreSQL.
3. Install packages with `npm install`.
4. Apply migrations with `npm run db:migrate`.
5. Start the application with `npm run dev`, then open `http://localhost:3000`.

The static portfolio is at `/`, and the account registration/sign-in and proposal dashboard are at `/portal`. Account creation requires a working SMTP configuration; email addresses must be verified before clients can sign in or submit proposals.

## Promote an administrator

Register a client account, verify its email, then run:

```powershell
npm run db:promote-admin -- franklin@example.com
```

Only a verified account can be promoted. Admin API routes use the same authenticated session as the client portal.

## API

- `GET /api/health` — application and PostgreSQL readiness
- `POST /api/auth/register` — create a client and send email verification
- `POST /api/auth/verify-email` — verify a one-time email token
- `POST /api/auth/resend-verification` — send another verification link
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/proposals`, `GET /api/proposals`, `GET /api/proposals/:id`
- `GET /api/admin/clients`, `GET /api/admin/proposals`, `PATCH /api/admin/proposals/:id`

Sessions use random opaque tokens in `HttpOnly` cookies; only SHA-256 token hashes are persisted. Production deployments must use HTTPS. Set `DATABASE_SSL=true` when the PostgreSQL provider requires TLS and `TRUST_PROXY=true` only when the app is behind a trusted reverse proxy.

## Tests

Run the unit and HTTP tests with `npm test`. Database-backed route tests run when `DATABASE_URL` is configured and the migration has been applied.
