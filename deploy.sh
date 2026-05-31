#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh
# Automated deployment script for AWS EC2 (Ubuntu).
# Installs Docker, clones the repository, sets up environment variables,
# and deploys the StudyApp via docker-compose.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Starting StudyApp Deployment on AWS EC2..."

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
sudo docker compose build
sudo docker compose up -d

echo "🎉 Deployment Complete!"
echo "Your application should now be live at: https://$DOMAIN"
echo "If you used a real domain, Caddy is automatically generating your SSL certificates right now."
