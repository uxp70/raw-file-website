# 📦 Raw File Website (GitHub Pages ready)

Upload files, get **raw links** you can copy, share, hotlink or embed.

## How it works on GitHub Pages (static, no server)

GitHub Pages can't run an upload server, so this site stores uploads **inside your own repo** via the GitHub API:

1. Open the site, fill **owner / repo / branch** + a fine-grained PAT (Contents: read + write). Saved in your browser only.
2. Drag & drop files → they are committed to `uploads/` in your repo.
3. Every file gets working raw links you can copy:
   - `https://raw.githubusercontent.com/OWNER/REPO/BRANCH/uploads/…` (raw)
   - `https://OWNER.github.io/REPO/uploads/…` (Pages)
   - Open raw / Download / Delete buttons included.

> GitHub caps single files at **100 MB each** (and Git LFS can't help here: its upload server blocks browsers, its free quota is only 1 GB storage + 1 GB/month bandwidth, and LFS-tracked files serve as pointer text on raw links — which would break this site). So big files are handled by **automatic splitting instead**:

- Files up to **~40 MB** upload as one file with a direct raw link (if GitHub refuses one, the site splits it automatically and tells you).
- Files **~40 MB – 2 GB** are split into 10 MB pieces + a small manifest, all in `uploads/` (the API rejects bigger single blobs, so small pieces keep uploads reliable). The file appears as one 📦 entry. Then the **assemble workflow** (`.github/workflows/assemble.yml`) automatically reassembles the pieces and publishes the file as a **release asset** — a few minutes after upload you get a true **direct link** like `https://github.com/OWNER/REPO/releases/download/files/123-my-app.ipa` that serves the raw bytes. Ideal for repo / package-manager URLs. Links are tracked in `uploads/files-index.json`.
- Deleting a 📦 entry removes the manifest and all its pieces.

## Deploy to GitHub Pages (3 minutes)

1. Create a **public** repo, upload all these files to its root (`index.html` must be at root).
2. `Settings → Pages → Source: GitHub Actions`.
3. Push to `main` — the `pages.yml` workflow deploys automatically.
4. Open `https://OWNER.github.io/REPO/` → set owner/repo/branch + token → upload.

The `uploads/` folder is where files land. Keep `uploads/.gitkeep` so the folder exists.

## Self-host mode (unlimited size, optional)

Same `index.html` auto-detects a server. Run:

```sh
node server.js
# open http://localhost:3000
```

- `POST /api/upload?filename=…` streams raw bytes straight to `uploads/` — **no size limit, no memory buffering**.
- Raw links: `http://localhost:3000/raw/<id>` with correct Content-Type + Range support.
- `GET /api/files`, `DELETE /api/files/:id`, `GET /api/health`.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app (also copied to `public/index.html` for `server.js`) |
| `server.js` | Zero-dependency Node server (unlimited mode) |
| `public/index.html` | Static copy served by `server.js` |
| `.github/workflows/pages.yml` | Pages deploy workflow |
| `.nojekyll`, `404.html` | Pages helpers |
| `uploads/` | File storage (server disk, or repo folder on Pages) |
