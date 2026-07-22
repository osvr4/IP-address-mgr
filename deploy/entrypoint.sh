#!/bin/bash
set -e

CERT_DIR="/etc/nginx/certs"
mkdir -p "$CERT_DIR"

# Generate self-signed cert on first boot if not mounted
if [ ! -f "$CERT_DIR/server.crt" ] || [ ! -f "$CERT_DIR/server.key" ]; then
  echo "[entrypoint] Generating self-signed TLS certificate..."
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 3650 \
    -subj "/C=IN/ST=Internal/L=OnPrem/O=ThinkCloud/OU=IT/CN=${TLS_CN:-ipam.thinkcloud.local}" \
    -addext "subjectAltName=DNS:${TLS_CN:-ipam.thinkcloud.local},DNS:localhost,IP:127.0.0.1" \
    >/dev/null 2>&1
  echo "[entrypoint] Cert written to $CERT_DIR/server.crt (CN=${TLS_CN:-ipam.thinkcloud.local})"
fi

exec nginx -g "daemon off;"
