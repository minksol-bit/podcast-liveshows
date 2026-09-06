#!/bin/bash
# Zet de gemaakte commits live op GitHub Pages.
#
# Werkt zowel vanuit Terminal op de Mac als vanuit de Linux-omgeving waarin
# Claude werkt. Gebruikt de deploy-sleutel in .deploy/ (die staat in .gitignore
# en gaat dus nooit mee de publieke repo in).
set -e
cd "$(dirname "$0")"

SLEUTEL="$PWD/.deploy/id_ed25519"
HOSTS="$PWD/.deploy/known_hosts"

if [ ! -f "$SLEUTEL" ]; then
  echo "Geen deploy-sleutel gevonden in .deploy/ - zie bouwwijze.md" >&2
  exit 1
fi

# Een bestaande GIT_SSH_COMMAND (Claude's omgeving zet daar een proxy in) blijft
# staan; we plakken er alleen onze sleutel en known_hosts achter.
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -i $SLEUTEL -o IdentitiesOnly=yes -o UserKnownHostsFile=$HOSTS -o StrictHostKeyChecking=yes"

echo "Pushen naar $(git config --get remote.origin.url) ..."
git push origin master
echo
echo "Klaar. GitHub Pages publiceert dit binnen een paar minuten."
