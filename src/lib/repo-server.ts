import { join } from "path"
import { Repo } from "../../scripts/db/repo"

let _repo: Repo | null = null

export function getRepo(): Repo {
  if (!_repo) _repo = new Repo(join(process.cwd(), "data"))
  return _repo
}
