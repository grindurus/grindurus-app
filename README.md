# GRAI App — Grinders Artificial Index

Standalone Vite app for the GRAI (Grinders Artificial Index) page.

## Local development

```bash
npm install
npm run dev
```

The app runs at http://localhost:3001

## Build

```bash
npm run build
```

## Docker

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.

Create the shared network before the first run (if it does not exist yet):

```bash
docker network create grindurus
```

### Development (hot reload)

Source code is mounted into the container; port **3001** is exposed on the host:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Open http://localhost:3001

Stop:

```bash
docker compose -f docker-compose.dev.yml down
```

### Production (preview + Traefik)

Builds the app inside the container and serves it with `vite preview`. Routing goes through Traefik on the `grindurus` network (host `app.${DOMAIN}`).

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

Set `DOMAIN` in `.env` next to `docker-compose.yml` (defaults to `localhost`).

### Image only

```bash
docker build -t grindurus-app -f dockerfile .
docker run --rm -p 3001:3001 grindurus-app sh -c "npm run build && npm run preview -- --host 0.0.0.0 --port 3001"
```

## GitHub Pages

The app deploys automatically on every push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

**Live URL:** https://app.grindurus.xyz/

### One-time setup

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source** → choose **GitHub Actions**.
2. **Custom domain:** `app.grindurus.xyz` (CNAME `app` → `grindurus.github.io` in Namecheap).
3. Copy [`.env.example`](.env.example) values into **Settings → Secrets and variables → Actions**:
   - **Secrets** — RPC URLs, mint addresses, `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_BACKTEST_API_URL`, etc.
   - **Variables** (optional) — `VITE_GRAI_SOLANA_CLUSTER` (default `devnet`), `VITE_MAIN_APP_URL`.
3. Push to `main` or run the workflow manually (**Actions → Deploy to GitHub Pages → Run workflow**).

`VITE_*` variables are baked in at build time on CI. After changing secrets, re-run the workflow or push a commit.

### Local Pages preview

```bash
npm run preview:pages
```

Open http://localhost:4173/grai

## Environment variables

See [`.env.example`](.env.example) for the full list.

- `VITE_MAIN_APP_URL` — URL of the main GrindURUS app for the «← GrindURUS» header link. Defaults to `/` (link hidden).

For Docker, put `VITE_*` variables in `.env` or `.env.local` at the project root. They are picked up by `npm run build` / `npm run dev` inside the container.
