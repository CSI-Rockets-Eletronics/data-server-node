#!/bin/bash -i

SETUP_FILES_DIR=$(realpath "$(dirname "$0")")
REPO_DIR=$(realpath "$(dirname "$0")/..")

# Exit if .env doesn't exist
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "Please create a .env file in the root of the repository."
  echo "Set DATABASE_URL=\"postgresql://postgres@pass:5432/rockets-data?schema=public\""
  exit 1
fi

# Update the package list
sudo apt update

# Install PostgreSQL 15
sudo apt install -y postgresql-15

# Copy pg_hba.conf and postgresql.conf to the PostgreSQL config folder
cd "$SETUP_FILES_DIR"
sudo cp pg_hba.conf /etc/postgresql/15/main/
sudo cp postgresql.conf /etc/postgresql/15/main/

# Restart PostgreSQL to apply the new config
sudo systemctl restart postgresql

# Set PostgreSQL password for the postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'pass';"

# Install bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Node.js (necessary for Prisma)
sudo apt install -y nodejs

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
