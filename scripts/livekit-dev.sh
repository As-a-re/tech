#!/usr/bin/env bash
# Starts a free LiveKit server on this PC so voice and video calls work while testing.
# Leave this terminal open; PAPA keeps running in its own terminal. Stop with Ctrl+C.
set -e
cd "$(dirname "$0")/.."
if ! command -v livekit-server >/dev/null 2>&1; then
  echo "Installing LiveKit server (asks for your password once)…"
  curl -sSL https://get.livekit.io | bash
fi
# Point PAPA at this local server (only if no LiveKit settings are there yet)
if grep -q '^LIVEKIT_URL=$' .env.local 2>/dev/null || ! grep -q '^LIVEKIT_URL=' .env.local 2>/dev/null; then
  sed -i '/^LIVEKIT_URL=/d; /^LIVEKIT_API_KEY=/d; /^LIVEKIT_API_SECRET=/d' .env.local
  printf 'LIVEKIT_URL=ws://localhost:7880\nLIVEKIT_API_KEY=devkey\nLIVEKIT_API_SECRET=secret\n' >> .env.local
  echo "✓ Calls switched on in .env.local. Restart PAPA (Ctrl+C in its terminal, then: npm run dev)."
fi
echo "LiveKit is running for calls. Test with two browsers (e.g. a normal and a private window) signed in as two members."
exec livekit-server --dev
