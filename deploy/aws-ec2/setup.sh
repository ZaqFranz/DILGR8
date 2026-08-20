#!/usr/bin/env bash
# DILGR8RSP - one-time EC2 provisioning (Ubuntu 22.04/24.04 LTS).
#
# Run ONCE, on a fresh instance, as the default "ubuntu" user (it uses sudo
# itself - don't run the whole script as root):
#   chmod +x setup.sh && ./setup.sh
#
# What it does: installs Node.js, nginx, and MySQL server; creates a
# dedicated non-login system user to run the backend; clones the app;
# creates the app's MySQL database/user; generates a JWT secret; installs
# the nginx site and systemd service; then runs deploy.sh for the first
# build+migrate+start.
#
# Safe to inspect before running - read deploy/aws-ec2/README.md first for
# what each step means and why.

set -euo pipefail

# Ubuntu's apt (dpkg config prompts) and needrestart (which services to
# restart after a package upgrade) can otherwise pause waiting for
# interactive input mid-install - easy to mistake for the script hanging.
# This forces both to run fully non-interactively/automatically instead.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

REPO_URL="${REPO_URL:-https://github.com/ZaqFranz/DILGR8.git}"
APP_DIR="/var/www/dilgr8rsp"
SERVICE_USER="dilgr8rsp"

echo "==> Updating system packages"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing base packages (git, nginx, mysql-server, build tools)"
sudo apt-get install -y git nginx mysql-server build-essential curl

echo "==> Installing Node.js LTS (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version
npm --version

echo "==> Creating dedicated service user ($SERVICE_USER, no login shell)"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  sudo useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Cloning the app to $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "    $APP_DIR already exists - skipping clone (deploy.sh will git pull)"
fi
# git on Windows (where these scripts were authored) commonly has
# core.fileMode=false, so a local `chmod +x` never makes it into the
# commit's file mode - the clone above can come out non-executable
# regardless of what's in the repo. Setting it explicitly here means this
# doesn't depend on that being fixed upstream.
chmod +x "$APP_DIR/deploy/aws-ec2/setup.sh" "$APP_DIR/deploy/aws-ec2/deploy.sh"

echo "==> MySQL: creating the dilgr8rsp database and a dedicated app user"
echo "    (not reusing root - see backend.env.production.example)"
read -r -s -p "    Choose a password for the new MySQL user 'dilgr8rsp_app': " DB_PASSWORD
echo
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS dilgr8rsp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'dilgr8rsp_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON dilgr8rsp.* TO 'dilgr8rsp_app'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Writing backend/.env (generated JWT secret + your DB password)"
JWT_SECRET="$(openssl rand -hex 48)"
# IMDSv2: a plain GET against the metadata service now 401s on instances
# launched with IMDSv2 required (the default for new instances) - a
# session token has to be requested first and passed back as a header.
IMDS_TOKEN="$(curl -fsS --max-time 3 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)"
PUBLIC_IP="$(curl -fsS --max-time 3 -H "X-aws-ec2-metadata-token: ${IMDS_TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4 || echo "REPLACE_WITH_YOUR_EC2_PUBLIC_IP")"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  sed \
    -e "s#REPLACE_WITH_A_STRONG_PASSWORD#${DB_PASSWORD}#" \
    -e "s#REPLACE_WITH_OUTPUT_OF_openssl_rand_-hex_48#${JWT_SECRET}#" \
    -e "s#REPLACE_WITH_YOUR_EC2_PUBLIC_IP_OR_DOMAIN#${PUBLIC_IP}#" \
    "$APP_DIR/deploy/aws-ec2/backend.env.production.example" > "$APP_DIR/backend/.env"
  echo "    Wrote $APP_DIR/backend/.env - review it (especially SMTP, if you want real emails)"
else
  echo "    $APP_DIR/backend/.env already exists - leaving it alone"
fi

echo "==> Writing frontend/.env"
if [ ! -f "$APP_DIR/frontend/.env" ]; then
  cp "$APP_DIR/deploy/aws-ec2/frontend.env.production.example" "$APP_DIR/frontend/.env"
else
  echo "    $APP_DIR/frontend/.env already exists - leaving it alone"
fi

echo "==> Installing the nginx site"
sudo cp "$APP_DIR/deploy/aws-ec2/nginx.conf" /etc/nginx/sites-available/dilgr8rsp
sudo ln -sf /etc/nginx/sites-available/dilgr8rsp /etc/nginx/sites-enabled/dilgr8rsp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> Installing the systemd service"
sudo cp "$APP_DIR/deploy/aws-ec2/dilgr8rsp-backend.service" /etc/systemd/system/dilgr8rsp-backend.service
sudo systemctl daemon-reload
sudo systemctl enable dilgr8rsp-backend

echo "==> Running the first build + migrate + start via deploy.sh"
"$APP_DIR/deploy/aws-ec2/deploy.sh"

echo
echo "==> Done. Visit: http://${PUBLIC_IP}"
echo "    Seed an admin user with:"
echo "      cd $APP_DIR/backend && npx prisma db seed"
