#!/bin/bash
set -e

CERT_DIR="/etc/nginx/certs"
mkdir -p "$CERT_DIR"

# Generate self-signed cert on first boot if not mounted
if [ ! -f "$CERT_DIR/server.crt" ] || [ ! -f "$CERT_DIR/server.key" ]; then
  CN="${TLS_CN:-10.1.2.185}"
  SAN="DNS:${CN},DNS:localhost,IP:127.0.0.1,IP:10.1.2.185"
  if [ -n "$TLS_SAN" ]; then
    SAN="${SAN},${TLS_SAN}"
  fi
  echo "[entrypoint] Generating self-signed TLS certificate for $CN..."
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 3650 \
    -subj "/C=IN/ST=Internal/L=OnPrem/O=ThinkCloud/OU=IT/CN=${CN}" \
    -addext "subjectAltName=${SAN}" \
    >/dev/null 2>&1
  echo "[entrypoint] Cert written to $CERT_DIR/server.crt (CN=${CN})"
fi

exec nginx -g "daemon off;"
