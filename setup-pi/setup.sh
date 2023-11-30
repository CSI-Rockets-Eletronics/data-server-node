#!/bin/bash

SETUP_FILES_DIR=$(realpath "$(dirname "$0")")
REPO_DIR=$(realpath "$(dirname "$0")/..")

# Install PostgreSQL
sudo apt-get install -y postgresql

# Copy pg_hba.conf and postgresql.conf to the PostgreSQL config folder
cd "$SETUP_FILES_DIR"
sudo cp pg_hba.conf /etc/postgresql/15/main/
sudo cp postgresql.conf /etc/postgresql/15/main/

# Restart PostgreSQL to apply the new config
sudo systemctl restart postgresql

# Install bun
curl -fsSL https://bun.sh/install | bash

# Install Node.js (necessary for Prisma)
sudo apt-get install -y nodejs

# Install dependencies and generate Prisma client
cd "$REPO_DIR"
bun install
bun prisma:generate

# Copy the service file to the systemd services folder
cd "$SETUP_FILES_DIR"
sudo cp data-server-node.service /etc/systemd/system/

# Reload systemd daemon to read the new service file
sudo systemctl daemon-reload

# Enable the service to run on boot
sudo systemctl enable data-server-node.service

# Start the service
sudo systemctl restart data-server-node.service
