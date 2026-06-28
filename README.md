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

## Environment variables

- `VITE_MAIN_APP_URL` — URL of the main GrindURUS app for the «← GrindURUS» header link. Defaults to `/` (link hidden).

For Docker, put `VITE_*` variables in `.env` or `.env.local` at the project root. They are picked up by `npm run build` / `npm run dev` inside the container.
