#!/bin/bash

# Navigate to project root
cd "$(dirname "$0")"

# Pull latest code (including script updates)
git fetch origin main
git reset --hard origin/main

# Ensure script remains executable
chmod +x "$(dirname "$0")/update.sh"

# Update dependencies
source ../hdr-env/bin/activate
pip install -r requirements.txt

# Check for active connections on port 8501
ACTIVE_CONNECTIONS=$(ss -tn | grep ':8501' | grep ESTAB | wc -l)

if [ "$ACTIVE_CONNECTIONS" -eq 0 ]; then
    echo "No active users - restarting service" >> update.log
    sudo systemctl restart hdr-merger
else
    echo "Skipping restart: $ACTIVE_CONNECTIONS active connection(s)" >> update.log
fi

# Log timestamp
echo "Update check at $(date)" >> update.log