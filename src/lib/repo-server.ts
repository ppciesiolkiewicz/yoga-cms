import { join } from "path"
import { Repo } from "../../scripts/db/repo"

let _repo: Repo | null = null

export function getRepo(): Repo {
  if (!_repo) {
    const dataDir = process.env.YOGA_DATA_DIR ?? join(process.cwd(), "data")
    _repo = new Repo(dataDir)
  }
  return _repo
}

export function resetRepoForTests(): void {
  _repo = null
}
