#!/bin/bash

contract=$1
sig=$2

if [[ -z "$contract" ]]; then
    echo 'Invalid contract'
fi

if [[ -z "$sig" ]]; then
    echo 'Invalid signature'
fi

shift 2

# Perform a dry-run execution
# add --broadcast to parameters if you 
# want to broadcast the tx 
source ../.env
forge script \
    -vvvvv \
    --chain "${CHAIN_NAME:-sepolia}" \
    --password "$FORGE_KEYSTORE_PASSWORD" \
    --rpc-url "$SEPOLIA_RPC_URL" \
    --sig "$sig" \
    "$contract" \
    "$@"
