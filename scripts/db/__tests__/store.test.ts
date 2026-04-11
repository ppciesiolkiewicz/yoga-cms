import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Store } from "../store"

describe("Store", () => {
  let tmp: string
  let store: Store

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "store-"))
    store = new Store()
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("writes and reads a string file", async () => {
    const path = join(tmp, "a/b/c.txt")
    await store.writeFile(path, "hello")
    expect(await store.readFile(path)).toEqual(Buffer.from("hello"))
  })

  it("writes and reads a buffer file", async () => {
    const path = join(tmp, "x.bin")
    await store.writeFile(path, Buffer.from([1, 2, 3]))
    const buf = await store.readFile(path)
    expect(buf.equals(Buffer.from([1, 2, 3]))).toBe(true)
  })

  it("reports exists", async () => {
    const path = join(tmp, "y.txt")
    expect(await store.exists(path)).toBe(false)
    await store.writeFile(path, "y")
    expect(await store.exists(path)).toBe(true)
  })

  it("lists files recursively", async () => {
    await store.writeFile(join(tmp, "a.txt"), "")
    await store.writeFile(join(tmp, "sub/b.txt"), "")
    await store.writeFile(join(tmp, "sub/deep/c.txt"), "")
    const all = (await store.listFiles(tmp)).sort()
    expect(all).toEqual([
      join(tmp, "a.txt"),
      join(tmp, "sub/b.txt"),
      join(tmp, "sub/deep/c.txt"),
    ])
  })

  it("lists immediate directories", async () => {
    await store.writeFile(join(tmp, "r1/x.txt"), "")
    await store.writeFile(join(tmp, "r2/x.txt"), "")
    await store.writeFile(join(tmp, "r1/sub/y.txt"), "")
    const dirs = (await store.listDirs(tmp)).sort()
    expect(dirs).toEqual(["r1", "r2"])
  })
})
