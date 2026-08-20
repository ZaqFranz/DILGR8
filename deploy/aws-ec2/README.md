# Deploying DILGR8RSP to AWS (free tier, single EC2 instance)

The simplest shape that mirrors local dev: **one EC2 instance** runs nginx
(serving the built frontend + reverse-proxying `/api`), the Node backend
(as a systemd service), and MySQL - all on the same box. No RDS, no load
balancer, no separate frontend hosting. Free-tier eligible for 12 months
from account creation, as long as you stay within the limits noted below.

Everything here is a **script you run yourself on the instance over SSH** -
nothing here runs from your local machine or needs your AWS credentials
anywhere but your own terminal.

## 0. Create an AWS account

If you don't have one yet: go to https://aws.amazon.com, click **Create an
AWS Account**, and follow the signup flow (email, phone verification, and a
card for identity verification - free-tier usage itself won't charge it as
long as you stay within the limits below, but AWS does require a card on
file). This step is yours to do; it needs your own identity/payment details.

## 1. Launch the EC2 instance

In the [EC2 console](https://console.aws.amazon.com/ec2/), **Launch instance**:

| Setting | Value |
|---|---|
| Name | `dilgr8rsp-test` (or anything) |
| AMI | **Ubuntu Server 22.04 LTS** (or 24.04) - free-tier eligible |
| Instance type | **t2.micro** (or t3.micro if t2.micro isn't offered in your region) - free tier: 750 hrs/month for 12 months |
| Key pair | Create a new one, download the `.pem` file, keep it somewhere safe - it's the only way to SSH in |
| Storage | Default 8GB is fine; free tier covers up to 30GB gp2/gp3 if you want more headroom |

**Security group** - create a new one with exactly these inbound rules:

| Type | Port | Source | Why |
|---|---|---|---|
| SSH | 22 | **My IP** (not `0.0.0.0/0`) | so only you can SSH in |
| HTTP | 80 | `0.0.0.0/0` | so the app is reachable |

Do **not** open port 3306 (MySQL) or 4000 (the Node backend) to the
internet - nginx is the only public entry point; both of those stay
internal to the instance (see `nginx.conf` and the systemd service, which
binds the backend to `127.0.0.1` only).

## 2. (Recommended) Allocate an Elastic IP

A free-tier EC2 instance's public IP **changes every time you stop and
restart it** - annoying for repeat testing/demos. An Elastic IP is free
*as long as it's attached to a running instance* (AWS charges only for
Elastic IPs that are allocated but *not* attached to anything running).

In the EC2 console: **Elastic IPs** → **Allocate Elastic IP address** →
**Associate** it with your instance. Use that IP for everything below
instead of the instance's auto-assigned public IP.

## 3. Connect and provision

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<your-instance-public-ip>
```

Once connected, grab the deploy scripts and run the one-time setup. If
you've already pushed this repo to your own GitHub remote, `setup.sh`
defaults to cloning `https://github.com/ZaqFranz/DILGR8.git` - override
with `REPO_URL=<your-fork-url>` if that's not accurate for you:

```bash
git clone https://github.com/ZaqFranz/DILGR8.git dilgr8rsp-setup
cd dilgr8rsp-setup/deploy/aws-ec2
chmod +x setup.sh deploy.sh
./setup.sh
```

`setup.sh` is idempotent and safe to re-read before running - it:
1. Installs Node.js (LTS), nginx, and MySQL server via apt.
2. Creates a dedicated `dilgr8rsp` system user (no login shell) that the
   backend runs as - not root, not `ubuntu`.
3. Clones the app to `/var/www/dilgr8rsp`.
4. Creates the `dilgr8rsp` MySQL database and a dedicated `dilgr8rsp_app`
   MySQL user (**you'll be prompted to choose that user's password** -
   typed into your own SSH session, never seen by anyone else).
5. Writes `backend/.env` and `frontend/.env` from the templates in this
   folder, auto-filling the MySQL password you just chose, a freshly
   generated `JWT_SECRET` (`openssl rand -hex 48`), and the instance's
   public IP for `CORS_ORIGIN`.
6. Installs the nginx site (`nginx.conf`) and the systemd service
   (`dilgr8rsp-backend.service`).
7. Runs `deploy.sh` for the first build + migrate + start.

When it finishes, it prints the URL to visit.

## 4. Seed an admin account

```bash
cd /var/www/dilgr8rsp/backend
npx prisma db seed
```

Creates `admin@dilg.gov.ph` / `ChangeMe123!` (see `backend/prisma/seed.ts`)
plus two sample job postings. **Change that password immediately** after
your first login (Users Management, or ask Claude to reset it the way we
did for local dev).

## 5. Verify

Open `http://<your-instance-ip-or-elastic-ip>` in a browser. You should see
the same landing page as local dev. Log in as the seeded admin and confirm
the dashboard loads.

## Updating after this

Every time you want to ship new code:

```bash
ssh -i your-key.pem ubuntu@<your-instance-ip>
cd /var/www/dilgr8rsp && ./deploy/aws-ec2/deploy.sh
```

That's `git pull` + install + `prisma migrate deploy` + rebuild + restart
the service, in one command.

## Free tier limits worth tracking

- **EC2**: 750 hrs/month for 12 months on a t2.micro/t3.micro - one
  instance running 24/7 uses exactly that, so a single instance is fine,
  but a second one running concurrently would burn through the monthly
  hours faster.
- **EBS storage**: 30GB free (gp2/gp3) - default 8GB is well under that.
- **RAM: t2/t3.micro only has ~1GB, and no swap by default.** MySQL alone,
  plus the `npm ci`/build step, can exceed that and get killed by the
  kernel's OOM killer (confirmed on a real run - `systemctl status mysql`
  showed `Failed with result 'oom-kill'` in a restart loop). `setup.sh`
  now creates a 2GB swap file automatically to cover this - if you ever
  see a service crash-looping for no obvious reason, check
  `sudo systemctl status <service> --no-pager` for `oom-kill` in the
  output and `free -h` to confirm swap is actually active.
- **Data transfer out**: 100GB/month free - plenty for demo/testing traffic.
- Set a [billing alarm](https://console.aws.amazon.com/billing/home#/preferences)
  (Billing preferences → Alert me when my spend exceeds a threshold) so
  you find out immediately if anything drifts outside free tier, rather
  than at the end of the month.

## Known limitations of this setup

- **Uploaded files live on the instance's local disk**
  (`backend/uploads/`), per the existing local-dev convention (see
  `docs/decisions.md`). If you ever terminate this instance, those files
  are gone with it - fine for a test/demo deployment, not for anything
  you need to keep. A later production deployment should move this to S3.
- **No HTTPS.** This is HTTP-only, fine for an internal test/demo. Adding
  TLS later (e.g. via Certbot/Let's Encrypt, which needs a real domain
  name pointed at the instance) is a follow-up, not required to test the
  app.
- **No automated backups.** MySQL data lives only on this instance's EBS
  volume. For anything beyond a throwaway test, take an EBS snapshot
  periodically via the EC2 console.

## Tearing down

To stop incurring any charges at all: **Instance state → Terminate** in
the EC2 console (also release the Elastic IP if you allocated one - an
Elastic IP not attached to anything *does* cost money). Terminating
deletes the instance and its EBS volume (and therefore the database and
uploaded files) permanently.
