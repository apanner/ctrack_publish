import fs from "node:fs"
import https from "node:https"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { NodeHttpHandler } from "@smithy/node-http-handler"

const require = createRequire(import.meta.url)

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

export function loadPublisherEnv(): void {
  const candidates: string[] = [
    // Packaged install: CI-written config next to resources (not a dumped .env in the repo)
    typeof process.resourcesPath === "string" && process.resourcesPath
      ? path.join(process.resourcesPath, "publisher-config.env")
      : "",
    path.join(moduleDir, "..", "resources", "publisher-config.env"),
    // Dev / optional user overrides
    path.join(process.cwd(), ".env"),
    path.join(moduleDir, "..", ".env"),
    path.join(moduleDir, "..", "..", ".env"),
  ].filter(Boolean)

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false })
      console.log("[ctrack] loaded env:", envPath)
    }
  }
}

export function bootstrapWindowsTls(): void {
  if (process.platform !== "win32") return
  try {
    require("win-ca").inject("+")
    console.log("[ctrack] Windows TLS: loaded system CA store (win-ca)")
  } catch (error) {
    console.warn("[ctrack] win-ca inject skipped:", error instanceof Error ? error.message : error)
  }
}

export function createStorageRequestHandler(): NodeHttpHandler {
  return new NodeHttpHandler({
    requestTimeout: 600_000,
    connectionTimeout: 30_000,
    socketTimeout: 600_000,
    httpsAgent: new https.Agent({
      minVersion: "TLSv1.2",
      keepAlive: true,
    }),
  })
}

export function trimEnv(value: string | undefined | null): string {
  if (!value) return ""
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function normalizeEndpoint(endpoint: string | null | undefined): string | null {
  const trimmed = trimEnv(endpoint)
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, "")
}

export async function readUploadBody(filePath: string): Promise<Buffer> {
  return await fs.promises.readFile(filePath)
}
