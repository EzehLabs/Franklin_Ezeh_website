# EzehLabs portfolio and client API

The public portfolio is served by the same Express application as the client API. The first backend phase includes email-verified client accounts, persistent sessions, client IDs, client-owned project proposals, and administrator proposal/client management. Payments, realtime chat/calls, file uploads, and notification integrations are not part of this phase.

## Requirements

- Node.js 20 or newer
- Docker Desktop for the local PostgreSQL option, or an existing PostgreSQL database
- Brevo SMTP credentials and a verified sender to deliver account-verification emails

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

## Deploy to Render with Neon

1. Push this repository to GitHub and create a Neon PostgreSQL project.
2. In Render, choose **New > Blueprint** and select this repository. Render reads `render.yaml` and creates the Node web service.
3. In the Render service's environment settings, add the unsynced values:
   - `DATABASE_URL`: Neon’s pooled connection string. Keep its credentials private.
   - `APP_ORIGIN`: the deployed service origin, such as `https://your-service.onrender.com`, with no trailing slash.
   - `SMTP_USER`: your Brevo SMTP login (not your Brevo account password).
   - `SMTP_PASSWORD`: a Brevo SMTP key. Create one under Brevo **Transactional > Configuration > SMTP**; do not use a general API key.
   - `MAIL_FROM`: a sender address verified in Brevo.
4. Deploy or restart the service. Its start command applies pending database migrations before starting Express; `/api/health` checks both the app and Neon connection.

The app is configured for Brevo SMTP relay (`smtp-relay.brevo.com`, port `587`, STARTTLS). Keep the SMTP login and key only in Render's environment settings. The Blueprint uses Render's free web-service plan. Free web services can spin down when idle, so the first request after inactivity may take longer. Neon free-plan limits and retention are controlled by Neon; review its current terms and keep database credentials only in Render's environment settings. The site and portal are served from the same origin.

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
