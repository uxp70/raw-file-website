"""Rebuild uploads/list.json from git files (no API calls, no secrets).

Public data only: names, sizes, and already-public raw/release URLs.
Run in CI after uploads change; SEUHQ reads this single file instead of
hammering the GitHub API (which is rate-limited for anonymous clients).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UP = os.path.join(ROOT, "uploads")
BASE = "https://raw.githubusercontent.com/uxp70/raw-file-website/main"
SKIP = {".gitkeep", "files-index.json", "list.json"}


def is_part(name):
    i = name.rfind(".part")
    return i > 0 and name[i + 5:].isdigit()


def main():
    try:
        with open(os.path.join(UP, "files-index.json"), encoding="utf-8") as f:
            index = json.load(f)
    except (OSError, ValueError):
        index = {}
    if not isinstance(index, dict):
        index = {}

    files = []
    for name in sorted(os.listdir(UP)):
        p = os.path.join(UP, name)
        if not os.path.isfile(p) or name in SKIP or is_part(name):
            continue
        if name.endswith(".manifest.json"):
            try:
                with open(p, encoding="utf-8") as f:
                    m = json.load(f)
            except (OSError, ValueError):
                continue
            if not isinstance(m, dict) or m.get("type") != "bigfile":
                continue
            hit = index.get("uploads/" + name, {})
            files.append({
                "name": m.get("original", name),
                "size": m.get("size", os.path.getsize(p)),
                "raw": hit.get("url"),
                "path": "uploads/" + name,
                "big": True,
            })
        else:
            files.append({
                "name": name,
                "size": os.path.getsize(p),
                "raw": f"{BASE}/uploads/{name}",
                "path": "uploads/" + name,
            })

    with open(os.path.join(UP, "list.json"), "w", encoding="utf-8") as f:
        json.dump(files, f)
    print(f"wrote list.json with {len(files)} entries")


if __name__ == "__main__":
    main()
