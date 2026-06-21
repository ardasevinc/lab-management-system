# CapRover GitHub Deploy

Use this path for MIRALAB LMS after the first CapRover app is configured.

## 1. Publish the Repository

This repo currently needs a GitHub `origin` before CapRover can deploy from
GitHub.

For a private repo under Arda's GitHub account:

```sh
gh repo create ardasevinc/lab-management-system --private --source=. --remote=origin --push
```

If the repo already exists, use:

```sh
git remote add origin https://github.com/ardasevinc/lab-management-system.git
git push -u origin main
```

Then check deploy readiness:

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

Create the app hostname before issuing HTTPS:

```txt
lms.miralab.tr A 130.61.34.1
```

If Cloudflare DNS edit credentials are stored in `pa`:

```sh
bun run setup:cloudflare-dns
bun run verify:caprover-dns
```

Use DNS-only for the first deploy and certificate issue.

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

## 4. Environment

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

## 5. GitHub Deployment Settings

In the CapRover app's **Deployment** tab, use the GitHub/Bitbucket/GitLab
method:

```txt
repo: https://github.com/ardasevinc/lab-management-system.git
branch: main
captain-definition path: captain-definition
```

For a private repository, give CapRover read access using the dashboard's
private-repo credentials fields. Prefer a narrowly scoped GitHub token or deploy
credential instead of Arda's main GitHub password.

Save the deployment configuration and run **Force Build** for the first deploy.

After the first successful build, copy the CapRover webhook URL into GitHub:

```txt
GitHub repo -> Settings -> Webhooks -> Add webhook
payload URL: <CapRover webhook URL>
content type: application/json
events: Just the push event
```

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
