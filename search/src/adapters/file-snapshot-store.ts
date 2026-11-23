import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { SavedIndex, SnapshotStore } from "../application/ports.js"

/** The index as a JSON file next to the service (public catalog data only). Written atomically: temp file, then rename. */
export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly path: string) {}

  async read() {
    try { return JSON.parse(await readFile(this.path, "utf8")) } catch { return null }
  }

  async write(snapshot: SavedIndex) {
    await mkdir(dirname(this.path), { recursive: true })
    const temp = `${this.path}.tmp`
    await writeFile(temp, JSON.stringify(snapshot))
    await rename(temp, this.path)
  }
}
