#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh
# Automated deployment script for AWS EC2 (Ubuntu).
# Installs Docker, clones the repository, sets up environment variables,
# and deploys the StudyApp via docker-compose.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "🚀 Starting StudyApp Deployment on AWS EC2..."

# 0. Add Swap Space to prevent Out-Of-Memory (OOM) kills during build
echo "💾 Checking system memory and swap..."
if [ $(free | awk '/^Swap:/ {print $2}') -eq 0 ]; then
    echo "⚙️  No swap space detected. Creating 2GB swapfile..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap space enabled to prevent build crashes."
else
    echo "✅ Swap space is already configured."
fi

# 1. Update system and install required dependencies
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git

# 2. Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "✅ Docker installed successfully. Note: You may need to log out and log back in for group changes to take effect."
else
    echo "✅ Docker is already installed."
fi

# 3. Request environment variables from the user
echo "🔑 Please provide the necessary environment variables."
read -p "Enter your Domain Name (e.g., app.yourdomain.com) or 'localhost' if testing locally: " DOMAIN
read -p "Enter your Google Gemini API Key: " GEMINI_API_KEY

# 4. Create the .env file
echo "📝 Generating .env file..."
cat << EOF > .env
# Application Settings
DOMAIN=$DOMAIN
NEXT_PUBLIC_BACKEND_URL=https://$DOMAIN
BACKEND_URL=http://backend:8000

# Backend Config
GEMINI_API_KEY=$GEMINI_API_KEY

# ChromaDB Internal Networking
CHROMA_HOST=chromadb
CHROMA_PORT=8000
EOF

# 5. Build and deploy
echo "🏗️ Building and spinning up the Docker cluster..."
# Ensure the knowledge_base directory exists so permissions map correctly
mkdir -p knowledge_base uploads

echo "🔨 Building Backend image (1/2)..."
sudo docker compose build backend

echo "🔨 Building Next.js image (2/2)..."
sudo docker compose build nextjs

echo "🚀 Launching all containers..."
sudo docker compose up -d

echo "🎉 Deployment Complete!"
echo "Your application should now be live at: https://$DOMAIN"
echo "If you used a real domain, Caddy is automatically generating your SSL certificates right now."
