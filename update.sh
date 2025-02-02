#!/bin/bash

# Navigate to project
cd ~/Open-HDR-Merger

# Pull latest code
git fetch origin main
git reset --hard origin/main

# Update dependencies
source ~/hdr-env/bin/activate
pip install -r requirements.txt

# Restart service
sudo systemctl restart hdr-merger