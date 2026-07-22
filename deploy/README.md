# ThinkCloud IPAM — On-Prem Deployment

Turnkey Docker deployment for hosting IPAM on your internal network at a private IP.

## What you get

- **frontend** — React SPA served by nginx on ports **80 → 443** (HTTP redirects to HTTPS). Auto-generates a self-signed TLS cert on first boot.
- **backend** — FastAPI on port 8001 (internal only, reverse-proxied via `/api` by nginx).
- **mongo** — MongoDB 7 with a named volume for durable storage.

## Requirements

- Docker 24+ and Docker Compose v2
- Linux host that has **L3 routing to all managed subnets** (10.1.0.0/22, 192.168.100.0/24, 172.16.0.0/22). Verify with:
  ```bash
  ping -c1 10.1.0.1 && ping -c1 192.168.100.1 && ping -c1 172.16.0.1
  ```
  If any of these fail, either move the host, add static routes, or open firewall rules before deploying.

## First-time setup

```bash
cd deploy/
cp .env.example .env
# 1) Generate a strong JWT secret
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
# 2) Change ADMIN_PASSWORD to something you'll actually rotate
$EDITOR .env

# Build + start
docker compose up -d --build
```

Visit `https://<host-ip>/` — accept the self-signed cert warning on first visit — and sign in as `admin@thinkcloud.in` with your `ADMIN_PASSWORD`.

## Network access from the backend container

The backend container needs to send ICMP echo (ping) to the managed subnets. Two options:

### Option A — Bridge network (default, works if the host can route AND the bridge allows ICMP out)
The compose file already grants `NET_RAW` and `NET_ADMIN` capabilities. In most setups this is enough:
```yaml
cap_add:
  - NET_RAW
  - NET_ADMIN
```

### Option B — Host networking (recommended when the host has direct L2/L3 to the subnets)
Edit `docker-compose.yml`, on the `backend` service replace the `networks:` block with:
```yaml
network_mode: "host"
```
Then also change the frontend `nginx.conf` `proxy_pass` from `http://backend:8001` to `http://host.docker.internal:8001` (Linux users: `http://172.17.0.1:8001` or the host's LAN IP).

## Bring your own TLS cert

Drop your cert + key into the `ipam_tls` volume:
```bash
docker cp your.crt ipam_frontend:/etc/nginx/certs/server.crt
docker cp your.key ipam_frontend:/etc/nginx/certs/server.key
docker compose restart frontend
```
The entrypoint only generates a self-signed cert when `server.crt` or `server.key` is missing.

## Toggling simulated mode

- **Production (real ping/DNS):** `IPAM_SIMULATED=false` (default in `.env.example`).
- **Demo / preview (fake data):** `IPAM_SIMULATED=true`.

Change `.env` and run `docker compose up -d backend` — only the backend restarts.

## Backup

```bash
docker exec ipam_mongo mongodump --db=thinkcloud_ipam --archive=/tmp/dump.archive
docker cp ipam_mongo:/tmp/dump.archive ./ipam-$(date +%F).archive
```

## Upgrade

```bash
git pull
docker compose up -d --build
```

## Troubleshooting

- **`ping: socket: Operation not permitted`** inside the backend container → add `--cap-add=NET_RAW` or use host networking.
- **Login works but network requests 500** → check `docker compose logs backend`; often it's the DB name or JWT secret.
- **Preview shows "0 addresses"** even in production → your host cannot reach the subnets. Test with `docker exec ipam_backend ping -c1 10.1.0.1`.
- **Cert warning in browser** → normal for self-signed. Add the generated `server.crt` to your device's trust store, or drop in a real cert per "Bring your own TLS cert" above.
