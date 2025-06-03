#!/bin/bash

echo "🔧 Fixing pnpm lockfile mismatch..."

# Step 1: Remove old lockfile and node_modules
echo "📁 Removing old lockfile and node_modules..."
rm -rf pnpm-lock.yaml node_modules

# Step 2: Clear pnpm cache
echo "🧹 Clearing pnpm cache..."
pnpm store prune

# Step 3: Install dependencies with fresh lockfile
echo "📦 Installing dependencies with fresh lockfile..."
pnpm install --no-frozen-lockfile

# Step 4: Verify installation
echo "✅ Verifying installation..."
pnpm list --depth=0

echo ""
echo "🎉 Lockfile fixed! You can now run:"
echo "   pnpm dev              (start development server)"
echo "   pnpm run server       (start Socket.IO server)"
echo "   pnpm build            (build for production)"
echo ""
echo "📝 Next steps:"
echo "1. Run 'chmod +x fix-lockfile.sh && ./fix-lockfile.sh' to fix dependencies"
echo "2. Create server directory: 'mkdir server && cd server'"
echo "3. Set up server: 'npm init -y && npm install express socket.io cors nodemon'"
echo "4. Copy server.js code from the project"
echo "5. Start server: 'npm run dev'"
echo "6. Start client: 'pnpm dev'"
