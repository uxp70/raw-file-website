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

> GitHub caps files at **100 MB each**. Truly unlimited sizes are impossible on Pages (static hosting has no server). For unlimited, use self-host mode below.

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
