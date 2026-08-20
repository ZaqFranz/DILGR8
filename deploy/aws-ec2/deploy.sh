#!/usr/bin/env bash
# DILGR8RSP - repeatable deploy/update. Run this on the EC2 instance
# (as the "ubuntu" user, same one setup.sh ran as) every time you want to
# pull and ship the latest code:
#   cd /var/www/dilgr8rsp && ./deploy/aws-ec2/deploy.sh
#
# setup.sh also calls this once at the end of first-time provisioning.

set -euo pipefail

APP_DIR="/var/www/dilgr8rsp"
SERVICE_USER="dilgr8rsp"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm ci

echo "==> Generating the Prisma client"
npm run prisma:generate --workspace backend

echo "==> Applying database migrations"
npm run prisma:deploy --workspace backend

echo "==> Building backend + frontend"
npm run build

echo "==> Ensuring uploads/ is writable by the service user"
mkdir -p "$APP_DIR/backend/uploads"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR/backend/uploads"

echo "==> Restarting the backend service"
sudo systemctl restart dilgr8rsp-backend
sudo systemctl --no-pager --full status dilgr8rsp-backend | head -n 10

echo "==> Done"
