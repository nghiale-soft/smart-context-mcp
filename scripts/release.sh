#!/usr/bin/env bash
set -e

echo "📦 Packaging Smart Context MCP Release..."

# 1. Build TypeScript ESM output
npm run build

# 2. Prepare release directory
RELEASE_DIR="release"
BUNDLE_DIR="${RELEASE_DIR}/smart-context-mcp-release"
rm -rf "${RELEASE_DIR}"
mkdir -p "${BUNDLE_DIR}"

# 3. Copy dist, package.json, README, and production node_modules
cp -R dist "${BUNDLE_DIR}/"
cp package.json "${BUNDLE_DIR}/"
cp README.md "${BUNDLE_DIR}/"
cp -R node_modules "${BUNDLE_DIR}/"

# 4. Create executable launcher script inside release bundle
cat << 'EOF' > "${BUNDLE_DIR}/smart-context-mcp"
#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if command -v node >/dev/null 2>&1; then
  exec node "$DIR/dist/index.js" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun "$DIR/dist/index.js" "$@"
else
  echo "Error: Node.js or Bun is required to run Smart Context MCP." >&2
  exit 1
fi
EOF
chmod +x "${BUNDLE_DIR}/smart-context-mcp"

# 5. Zip bundle into release/smart-context-mcp-v1.0.0.zip
cd "${RELEASE_DIR}"
zip -r "smart-context-mcp-v1.0.0.zip" "smart-context-mcp-release" > /dev/null

# 6. Clean up temporary unzipped folder so ONLY the zip file remains in release/
rm -rf "smart-context-mcp-release"
cd ..

echo "✅ Pre-built release package created at: ${RELEASE_DIR}/smart-context-mcp-v1.0.0.zip"
