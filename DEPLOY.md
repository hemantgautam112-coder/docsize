# Deploying HDVault to hdvault.in

This runs the app on an Oracle Cloud Ubuntu server (ARM) with Docker. Caddy serves the site and gets the HTTPS certificate automatically. PostgreSQL holds the data, and uploaded files are stored on the server disk in a Docker volume.

## Stack

| Container | Role | Published to internet |
|---|---|---|
| `web` | Caddy: serves the React build, proxies `/api`, HTTPS | 80, 443 |
| `api` | FastAPI backend (one worker) | No |
| `db` | PostgreSQL 16 | No |

## 1. Point the domain to the server (GoDaddy)

1. Sign in at GoDaddy → **My Products** → **Domains** → **hdvault.in** → **DNS**.
2. Find the existing **A** record for `@`, edit it, and set **Value** to the server's public IP (`140.245.23.156`).
3. Save. The change can take up to a few hours to spread. Check it from your PC:
   ```powershell
   nslookup hdvault.in
   ```
   It should show `140.245.23.156`.

Caddy can only get the certificate after this resolves.

## 2. Create a read-only deploy key on the server

The GitHub repository is private, so the server needs its own key to clone it.

```bash
ssh-keygen -t ed25519 -C "hdvault-deploy" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub
```

Copy the output. On GitHub, open **github.com/hemantgautam112-coder/docsize → Settings → Deploy keys → Add deploy key**, paste it, leave **Allow write access** unticked, and save.

Then tell SSH to use that key for GitHub:
```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_key
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

## 3. Install Docker and get the code

Docker was installed in an earlier step. Clone the repository:

```bash
cd ~
git clone git@github.com:hemantgautam112-coder/docsize.git
cd docsize
```

## 4. Create the production `.env` on the server

Never copy your PC's `.env` to the server. Create a new one:

```bash
cp .env.example .env
nano .env
```

Set these values:
- `POSTGRES_PASSWORD`: a long password using only letters and numbers. Special characters break the database URL.
- `SECRET_KEY`: run `openssl rand -base64 48` and paste the result.
- `ADMIN_EMAILS`: your admin email address.
- `SMTP_PASSWORD`: the Gmail app password. Use a **new** one, since the old one was shared in chat.

Save with `Ctrl+O`, Enter, then exit with `Ctrl+X`. Then lock the file:
```bash
chmod 600 .env
```

## 5. Start the stack

```bash
docker compose up -d --build
docker compose ps
```

The first build takes several minutes. All three services should show `running` (or `healthy` for `db`).

Check the logs if anything is wrong:
```bash
docker compose logs -f web
docker compose logs -f api
```

## 6. Check the site

- Open **https://hdvault.in**. It should show the HDVault login page with a padlock.
- Open **https://hdvault.in/api/health**. It should show `{"status":"ok","database":"ok"}`.
- Sign up with an email address, and check the inbox for the code.

## 7. Daily cleanup

Processed copies expire after 30 days, and this script deletes them. Schedule it with cron:

```bash
crontab -e
```

Add this line at the end:
```
0 2 * * * cd /home/ubuntu/docsize && docker compose exec -T api python scripts/cleanup_expired.py >> /home/ubuntu/cleanup.log 2>&1
```

## 8. Backups

Run this once a day from cron as well, or before any risky change:

```bash
cd ~/docsize
mkdir -p ~/backups
docker compose exec -T db pg_dump -U docsize docsize | gzip > ~/backups/db-$(date +%F).sql.gz
docker run --rm -v docsize_docsize_files:/data -v ~/backups:/backup alpine tar czf /backup/files-$(date +%F).tar.gz -C /data .
```

Copy the `~/backups` folder off the server regularly. A backup on the same disk doesn't protect against disk failure.

## Updating the site

After you push changes to GitHub:

```bash
cd ~/docsize
git pull
docker compose up -d --build
```

## Troubleshooting

- **No certificate / site not loading:** DNS isn't pointing to the server yet, or ports 80 and 443 are blocked. Check `nslookup hdvault.in` and the security list rules from the Oracle console, plus the server's `iptables`.
- **"database" error on `/api/health`:** check `docker compose logs db` and that `POSTGRES_PASSWORD` has no special characters.
- **Login codes don't arrive:** check `docker compose logs api` for SMTP errors. Confirm the Gmail app password is current.
