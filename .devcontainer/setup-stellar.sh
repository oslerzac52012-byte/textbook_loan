#!/usr/bin/env bash

set -euo pipefail

echo "============================================================"
echo "Setting up the Textbook Loan Stellar environment"
echo "============================================================"

echo ""
echo "Checking Stellar CLI runtime dependencies..."

if ! ldconfig -p 2>/dev/null | grep -q "libdbus-1.so.3"; then
  echo "Installing libdbus runtime..."

  sudo apt-get update
  sudo apt-get install -y --no-install-recommends libdbus-1-3
else
  echo "libdbus runtime is already installed."
fi

if [ -f "${HOME}/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
fi

export PATH="/usr/local/bin:${HOME}/.cargo/bin:${HOME}/.local/bin:${PATH}"

echo ""
echo "Checking Stellar CLI..."

if ! command -v stellar >/dev/null 2>&1; then
  echo "Installing Stellar CLI..."

  curl -fsSL \
    https://github.com/stellar/stellar-cli/raw/main/install.sh \
    | sh
else
  echo "Stellar CLI binary is already installed."
fi

hash -r

if ! stellar --version >/dev/null 2>&1; then
  echo "Stellar CLI exists but cannot run."
  echo "Checking linked libraries:"

  ldd "$(command -v stellar)" || true

  exit 1
fi

echo ""
echo "Checking Rust components..."

rustup target add wasm32v1-none
rustup component add rustfmt clippy

echo ""
echo "Installed tool versions:"

node --version
npm --version
rustc --version
cargo --version
rustup --version
stellar --version

echo ""
echo "Installed Rust targets:"

rustup target list --installed

echo ""
echo "Stellar Codespaces environment is ready."
