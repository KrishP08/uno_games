#!/bin/bash

echo "🔧 Fixing pnpm lockfile issues..."

# Step 1: Remove old lockfile (optional but recommended)
echo "📁 Removing old lockfile..."
rm -f pnpm-lock.yaml

# Step 2: Clear pnpm cache (optional but helps with conflicts)
echo "🧹 Clearing pnpm cache..."
pnpm store prune

# Step 3: Install with fresh lockfile generation
echo "📦 Installing dependencies and generating fresh lockfile..."
pnpm install --no-frozen-lockfile

# Step 4: Verify installation
echo "✅ Verifying installation..."
pnpm list --depth=0

echo "🎉 Dependencies fixed! You can now run:"
echo "   pnpm dev    (start development server)"
echo "   pnpm build  (build for production)"
