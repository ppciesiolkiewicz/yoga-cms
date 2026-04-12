import { mkdir, readFile, writeFile, stat, readdir } from "fs/promises"
import { dirname, join } from "path"

export class Store {
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }

  async readFile(path: string): Promise<Buffer> {
    return await readFile(path)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path)
      return true
    } catch {
      return false
    }
  }

  async listDirs(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true })
      return entries.filter(e => e.isDirectory()).map(e => e.name)
    } catch {
      return []
    }
  }

  async listFiles(path: string): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: string) => {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) await walk(full)
        else out.push(full)
      }
    }
    await walk(path)
    return out
  }
}
