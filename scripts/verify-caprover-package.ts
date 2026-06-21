import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

const captainPath = Bun.argv[2] ?? "captain-definition"
const dockerfilePath = Bun.argv[3] ?? "Dockerfile"
const captain = await parseCaptainDefinition(captainPath)
const dockerfile = await Bun.file(dockerfilePath).text()

assertCaptainDefinition(captain)
assertDockerfile(dockerfile)

console.log(`verified CapRover package: ${captainPath} -> ${dockerfilePath}`)

type CaptainDefinition = {
  schemaVersion?: unknown
  dockerfilePath?: unknown
}

async function parseCaptainDefinition(path: string): Promise<CaptainDefinition> {
  if (!existsSync(path)) {
    throw new Error(`CapRover captain-definition not found: ${path}`)
  }

  const contents = await Bun.file(path).text()
  try {
    const parsed = JSON.parse(contents) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("captain-definition must be a JSON object")
    }

    return parsed
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`captain-definition is not valid JSON: ${error.message}`)
    }

    throw error
  }
}

function assertCaptainDefinition(captain: CaptainDefinition) {
  if (captain.schemaVersion !== 2) {
    throw new Error("captain-definition schemaVersion must be 2")
  }

  if (captain.dockerfilePath !== "./Dockerfile") {
    throw new Error("captain-definition dockerfilePath must be ./Dockerfile")
  }

  const resolvedDockerfile = join(dirname(captainPath), captain.dockerfilePath)
  if (!existsSync(resolvedDockerfile)) {
    throw new Error(`captain-definition dockerfilePath does not exist: ${resolvedDockerfile}`)
  }
}

function assertDockerfile(contents: string) {
  assertContains(contents, "FROM oven/bun:", "Dockerfile must build from the Bun image")
  assertContains(contents, "RUN bun run build", "Dockerfile must build the monorepo before runtime")
  assertContains(
    contents,
    "ENV NODE_ENV=production",
    "Dockerfile must default NODE_ENV to production",
  )
  assertContains(contents, "ENV PORT=3001", "Dockerfile must default PORT to 3001")
  assertContains(contents, "ENV SERVE_WEB=1", "Dockerfile must serve the built Vite app")
  assertContains(
    contents,
    "ENV WEB_DIST_DIR=/app/apps/web/dist",
    "Dockerfile must point WEB_DIST_DIR at the built web app",
  )
  assertContains(
    contents,
    "ENV DATABASE_URL=file:/app/data/lab.sqlite",
    "Dockerfile must store SQLite under the mounted /app/data path",
  )
  assertContains(
    contents,
    "ENV BACKUP_DIR=/app/data/backups",
    "Dockerfile must keep backups under the mounted /app/data path",
  )
  assertContains(contents, "EXPOSE 3001", "Dockerfile must expose the CapRover app port")
  assertContains(contents, "/health", "Dockerfile must include a /health healthcheck")
  assertContains(
    contents,
    'CMD ["bun", "apps/api/src/index.ts"]',
    "Dockerfile must run the Hono API entrypoint",
  )
}

function assertContains(contents: string, expected: string, message: string) {
  if (!contents.includes(expected)) {
    throw new Error(message)
  }
}
