#!/bin/bash
dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/start-nodeos.sh"
source "$dir_name/create-wallet.sh"
source "$dir_name/create-account.sh"
source "$dir_name/activate-protocol-features.sh"

set -e

# Folder data is defined inside utils.sh
dir_data="$dir_name/$FOLDER_EOS_DATA"

echo "Starting nodeos..."

abort_if_nodeos_in_background

mkdir -p "$dir_data"

start_nodeos

echo "nodeos started..."

sleep 5

echo "Initializing protocol features..."


activate_protocol_features

# Create testnet wallets
create_wallet "evil"
create_wallet "user"
create_wallet "owner"

# ... and accounts
create_account "evil" "evil"
create_account "user" "user"
create_account "owner" "owner"

echo "Done!"