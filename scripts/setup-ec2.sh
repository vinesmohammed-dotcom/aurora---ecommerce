#!/usr/bin/env bash
# ==============================================================================
# Aurora E-Commerce — EC2 Host Provisioning Script
# Target OS: Ubuntu 24.04 LTS (Noble Numbat)
# Run as root or with sudo: sudo bash scripts/setup-ec2.sh
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " Starting Aurora EC2 Host Provisioning"
echo "========================================================"

# 1. Update and upgrade base system packages
echo "[1/6] Updating system packages..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# 2. Install essential system utilities
echo "[2/6] Installing core dependencies (curl, git, ufw, certbot)..."
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw \
  certbot \
  python3-certbot-nginx \
  htop \
  jq

# 3. Install official Docker Engine and Docker Compose plugin
echo "[3/6] Installing official Docker Engine..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group if running as standard user
if id "ubuntu" &>/dev/null; then
  usermod -aG docker ubuntu
  echo "Added 'ubuntu' user to docker group."
fi

# 4. Configure UFW (Uncomplicated Firewall) for least-privilege security
echo "[4/6] Configuring host firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (Port 22)
ufw allow 22/tcp comment 'SSH Access'

# Allow HTTP (Port 80) and HTTPS (Port 443)
ufw allow 80/tcp comment 'Nginx HTTP'
ufw allow 443/tcp comment 'Nginx HTTPS'

# Explicitly ensure backend port 5000 and MongoDB port 27017 are BLOCKED from external access
ufw deny 5000/tcp comment 'Block Direct Backend Access'
ufw deny 27017/tcp comment 'Block MongoDB Port'

# Enable UFW non-interactively
ufw --force enable
ufw status verbose

# 5. Create deployment directory
echo "[5/6] Setting up project deployment directory..."
DEPLOY_DIR="/opt/aurora-ecommerce"
mkdir -p "$DEPLOY_DIR"
chown -R ubuntu:ubuntu "$DEPLOY_DIR" || true

# 6. Setup automatic security updates
echo "[6/6] Enabling unattended security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive -p low unattended-upgrades

echo "========================================================"
echo " Aurora EC2 Host Provisioning Complete!"
echo " Docker Version: $(docker --version)"
echo " Docker Compose Version: $(docker compose version)"
echo "========================================================"
