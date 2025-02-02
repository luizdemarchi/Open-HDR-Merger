#!/bin/bash

# Navigate to project root (already here if cloned)
cd "$(dirname "$0")"

# Pull latest code (including script updates)
git fetch origin main
git reset --hard origin/main

# Ensure script remains executable
chmod +x "$(dirname "$0")/update.sh"

# Update dependencies
source ../hdr-env/bin/activate  # Adjust path if venv is outside repo
pip install -r requirements.txt

# Restart service
sudo systemctl restart hdr-merger

# Log timestamp
echo "Updated at $(date)" >> update.log