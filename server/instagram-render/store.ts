import "server-only";
import { mkdir, open, readFile, rename, readdir, rm, lstat, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { renderPolicy, type RenderJob } from "@/domain/content-intelligence/rendering";
import { requireCondition } from "@/domain/content-intelligence/types";
import { sha256 } from "./media";

const namePattern = /^(?:job\.json|slide-0[1-8]\.png|source-0[1-8]\.bin|caption\.txt|alt-text\.txt|sources\.json|instagram\.zip)$/;
export function localRenderRoot() {
  requireCondition(!process.env.VERCEL && process.env.HOOPFRENS_RENDERING_MODE === "local", "rendering-local-only", 503);
  const root = process.env.HOOPFRENS_RENDERING_DIR || path.join(homedir(), ".local/share/hoopfrens/instagram-renders");
  const checkout = process.cwd();
  requireCondition(path.isAbsolute(root) && !path.normalize(root).startsWith(checkout + path.sep) && path.normalize(root) !== checkout, "rendering-not-configured", 503);
  return root;
}
export class RenderStore {
  constructor(readonly root: string) {}
  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.root);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, "rendering-not-configured", 503);
  }
  async ownerDir(owner: string) {
    await this.init(); const dir = path.join(await realpath(this.root), sha256(owner));
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const stat = await lstat(dir); requireCondition(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, "rendering-not-configured", 503);
    return dir;
  }
  async dir(owner: string, id: string) {
    requireCondition(/^render-[a-f0-9]{64}$/.test(id), "record-not-available", 404);
    const dir = path.join(await this.ownerDir(owner), id);
    const stat = await lstat(dir).catch(() => null);
    requireCondition(stat?.isDirectory() && !stat.isSymbolicLink(), "record-not-available", 404); return dir;
  }
  async bytes(owner: string, id: string, name: string) {
    requireCondition(namePattern.test(name), "render-artifact-unavailable", 404);
    const file = await open(path.join(await this.dir(owner, id), name), constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
    requireCondition(file, "render-artifact-unavailable", 404);
    try { const s = await file.stat(); requireCondition(s.isFile() && s.size <= renderPolicy.maxJobBytes, "render-artifact-unavailable"); return await file.readFile(); }
    finally { await file.close(); }
  }
  async read(owner: string, id: string): Promise<RenderJob> {
    const job = JSON.parse((await this.bytes(owner, id, "job.json")).toString("utf8")) as RenderJob;
    requireCondition(job.ownerId === owner && job.id === id, "record-not-available", 404); return job;
  }
  async write(owner: string, id: string, name: string, bytes: Buffer) {
    requireCondition(namePattern.test(name) && bytes.length <= renderPolicy.maxJobBytes, "render-artifact-unavailable");
    const dir = await this.dir(owner, id); const temporary = path.join(dir, `.${randomUUID()}.tmp`);
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path.join(dir, name));
  }
  async list(owner: string) {
    const dir = await this.ownerDir(owner);
    const names = (await readdir(dir)).filter(n => /^render-[a-f0-9]{64}$/.test(n));
    return Promise.all(names.map(id => this.read(owner, id)));
  }
  async lock<T>(work: () => Promise<T>): Promise<T> {
    await this.init(); const lock = path.join(this.root, ".write-lock");
    let handle;
    for (let attempt = 0; attempt < 40 && !handle; attempt++) {
      try { handle = await open(lock, "wx", 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    // A dead-process lock requires operator recovery. Never reclaim a paused writer's lock by time.
    requireCondition(handle, "render-storage-busy", 409);
    try { await handle.writeFile(JSON.stringify({ pid: process.pid })); return await work(); }
    finally { await handle.close(); await rm(lock, { force: true }); }
  }
  async capacity(newJob: boolean) {
      let count = 0, bytes = 0;
      for (const owner of await readdir(this.root)) {
        if (!/^[a-f0-9]{64}$/.test(owner)) continue;
        const ownerPath = path.join(this.root, owner);
        if ((await lstat(ownerPath)).isSymbolicLink()) continue;
        for (const id of await readdir(ownerPath)) {
          if (!/^render-[a-f0-9]{64}$/.test(id)) continue;
          const dir = path.join(ownerPath, id); if ((await lstat(dir)).isSymbolicLink()) continue;
          const meta = JSON.parse(await readFile(path.join(dir, "job.json"), "utf8"));
          if (meta.status !== "deleted") count++;
          requireCondition(meta.status !== "running", "render-in-progress", 409);
          for (const name of await readdir(dir)) bytes += (await lstat(path.join(dir, name))).size;
        }
      }
      // Reserve a complete worst-case job before decoding or fetching a photo.
      requireCondition((!newJob || count < renderPolicy.maxJobs) && bytes + renderPolicy.maxJobBytes <= renderPolicy.maxStoredBytes, "render-storage-full", 429);
  }
  async create(job: RenderJob) {
    return this.lock(async () => {
      const existing = await this.read(job.ownerId, job.id).catch(() => null);
      if (existing) { requireCondition(existing.inputHash === job.inputHash, "request-id-reused", 409); return { job: existing, created: false }; }
      await this.capacity(true);
      await mkdir(path.join(await this.ownerDir(job.ownerId), job.id), { mode: 0o700 });
      await this.write(job.ownerId, job.id, "job.json", Buffer.from(JSON.stringify(job)));
      return { job, created: true };
    });
  }
  async update(owner: string, id: string, edit: (job: RenderJob) => RenderJob, reserve = false) {
    return this.lock(async () => { if (reserve) await this.capacity(false); const job = edit(await this.read(owner, id)); await this.write(owner, id, "job.json", Buffer.from(JSON.stringify(job))); return job; });
  }
  async removeFiles(owner: string, id: string) {
    const dir = await this.dir(owner, id);
    for (const name of await readdir(dir)) if (name !== "job.json") await rm(path.join(dir, name), { force: true });
  }
}
