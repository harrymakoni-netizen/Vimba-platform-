#!/usr/bin/env bash
# Generates production secrets on YOUR machine and uploads them straight to
# Vercel as sensitive environment variables. Nothing is printed or saved.
#
#   npm i -g vercel && vercel login
#   vercel link --yes --project vimba-platform --scope hjm-technologies
#   bash scripts/vercel-secrets.sh
#
# Re-running skips variables that already exist (rotate them in the dashboard).
set -euo pipefail

add() { # name value
  for target in production preview; do
    if vercel env ls "$target" 2>/dev/null | grep -q "^ *$1 "; then
      echo "skip $1 ($target): already set"
    else
      printf '%s' "$2" | vercel env add "$1" "$target" --sensitive >/dev/null && echo "set  $1 ($target)"
    fi
  done
}
rand() { node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"; }

KEYS=$(node -e "
const {generateKeyPairSync,randomBytes}=require('crypto');
const k=generateKeyPairSync('ed25519');
const b=(s)=>Buffer.from(s).toString('base64');
process.stdout.write([
 'prod-'+new Date().toISOString().slice(0,10)+'-'+randomBytes(3).toString('hex'),
 b(k.privateKey.export({type:'pkcs8',format:'pem'})),
 b(k.publicKey.export({type:'spki',format:'pem'}))].join(' '))")
read -r KEY_ID PRIV PUB <<<"$KEYS"

add VIMBA_SIGNING_KEY_ID "$KEY_ID"
add VIMBA_SIGNING_PRIVATE_KEY "$PRIV"
add VIMBA_SIGNING_PUBLIC_KEY "$PUB"
add VIMBA_APP_SECRET "$(rand)"
add VIMBA_WORKER_SECRET "$(rand)"
add CRON_SECRET "$(rand)"
add CHANNEL_SENDER_PEPPER "$(rand)"
add KAPSO_WEBHOOK_SECRET "$(rand)"
unset PRIV PUB KEYS
echo "Done. Redeploy for the new values to take effect."
