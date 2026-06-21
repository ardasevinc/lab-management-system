# CapRover GitHub Deploy

Use this path for MIRALAB LMS after the first CapRover app is configured. The
intended flow is GitHub Actions pushing a CapRover deploy archive with an app
token, not CapRover pulling from GitHub with GitHub credentials.

## 1. Publish the Repository

The public repository is:

```txt
https://github.com/ardasevinc/lab-management-system
```

Check deploy readiness before wiring CapRover:

```sh
bun run verify:github-deploy
```

The check requires:

- branch `main`
- clean tracked tree
- GitHub `origin`
- local `HEAD` pushed to `origin/main`
- valid `captain-definition` and Dockerfile
- valid CapRover env template

## 2. DNS

The app hostname should be DNS-only while CapRover issues certificates:

```txt
lms.miralab.tr A 130.61.34.1
```

Verify it with:

```sh
bun run verify:caprover-dns
```

On 2026-06-21, Codex created this record with the local `cf` CLI.

## 3. CapRover App

Create the app in the CapRover dashboard:

```txt
app name: miralab-lms
has persistent data: yes
instances: 1
container HTTP port: 3001
```

Add a persistent directory:

```txt
container path: /app/data
```

Keep the app at one instance while using SQLite.

## 4. CapRover Runtime Environment

Materialize the production env without printing secrets:

```sh
bun run prepare:caprover-env
```

Paste `.tmp/caprover.env` into the app's CapRover environment variables.

Expected fixed values:

```dotenv
APP_ENV=production
PORT=3001
PUBLIC_APP_URL=https://lms.miralab.tr
CORS_ORIGINS=https://lms.miralab.tr
SESSION_COOKIE_SECURE=1
SESSION_COOKIE_DOMAIN=
DATABASE_URL=file:/app/data/lab.sqlite
SERVE_WEB=1
WEB_DIST_DIR=/app/apps/web/dist
EMAIL_PROVIDER=ses
AWS_REGION=eu-central-1
SES_FROM_NAME=MIRALAB
SES_FROM_EMAIL=no-reply@miralab.tr
SES_REPLY_TO=support@miralab.tr
SES_CONFIGURATION_SET=miralab-lms
DEV_SHOW_OTP=0
REMINDERS_ENABLED=1
BACKUP_DATABASE_PATH=/app/data/lab.sqlite
BACKUP_DIR=/app/data/backups
BACKUP_RETENTION_DAYS=30
```

## 5. GitHub Actions Deploy

Do not fill the CapRover GitHub/Bitbucket/GitLab username/password fields. That
path makes CapRover pull from GitHub and asks for GitHub credentials even when a
safer app-token flow exists.

In the CapRover app's **Deployment** tab, click **Enable App Token** and copy the
token. Add it to the GitHub repo secrets:

```txt
CAPROVER_APP_TOKEN=<token from CapRover app Deployment tab>
CAPROVER_SERVER=https://captain.<your-caprover-root-domain>
```

The workflow at `.github/workflows/deploy.yml` uses:

```txt
app: miralab-lms
server: ${{ secrets.CAPROVER_SERVER }}
token: ${{ secrets.CAPROVER_APP_TOKEN }}
archive: deploy.tar generated from tracked git HEAD
```

It runs the CapRover package/env contract checks, the normal test gate, the
production build, then deploys `deploy.tar` to CapRover.

After adding the secrets, run the workflow manually once from GitHub:

```txt
GitHub repo -> Actions -> Deploy -> Run workflow
```

The first checked-in workflow is manual-dispatch only so the initial push does
not fail before the secrets exist. After the first green deploy, add a `push` on
`main` trigger in `.github/workflows/deploy.yml` if automatic deploys should
start immediately after every merge.

## 6. HTTPS And Smoke

After DNS resolves and the app deploys:

1. Add `lms.miralab.tr` to the app domain list.
2. Enable HTTPS in CapRover.
3. Run:

```sh
bun run verify:caprover-host --expect running
bun run verify:postdeploy https://lms.miralab.tr admin@miralab.tr
```

The postdeploy gate verifies container cardinality, public health, auth/session
cookies, booking CRUD, and start/ending reminder emails.
