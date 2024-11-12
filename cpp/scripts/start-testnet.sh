#!/bin/bash
dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/deploy.sh"
source "$dir_name/start-nodeos.sh"
source "$dir_name/create-wallet.sh"
source "$dir_name/create-account.sh"
source "$dir_name/eosio.token.sh"
source "$dir_name/xerc20.token.sh"
source "$dir_name/adapter.sh"
source "$dir_name/lockbox.sh"
source "$dir_name/feesmanager.sh"
source "$dir_name/add-code-permissions.sh"
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

# Create testnet wallets...
create_wallet "evil"
create_wallet "user"
create_wallet "owner"

# ... and accounts
create_account "evil" "evil"
create_account "user" "user"
create_account "owner" "owner"

create_account "eosio.token" "local"
create_account "xtoken" "owner"
create_account "lockbox" "owner"
create_account "feesmanager" "local"
create_account "adapter" "owner"

# ... and contracts
deploy eosio.token eosio.token
deploy adapter adapter
add_code_permissions adapter
deploy lockbox lockbox
add_code_permissions lockbox
deploy feesmanager feesmanager
deploy xerc20.token xtoken

SYMBOL=WRAM
XSYMBOL="X$SYMBOL"
SYMBOL_BYTES=0000000000000000000000000000000000000000000000000000004d41525758
MAX_SUPPLY=100000000000.0000
MINTING_LIMIT="2000.0000 $XSYMBOL"
BURNING_LIMIT="1500.0000 $XSYMBOL"
MIN_FEE="0.0000 $XSYMBOL"

# ... and the bridge
eosio.token create owner "$MAX_SUPPLY $SYMBOL"

xerc20.token xtoken@active create owner "$MAX_SUPPLY $XSYMBOL"
xerc20.token setlockbox lockbox
xerc20.token setlimits  adapter "$MINTING_LIMIT" "$BURNING_LIMIT"

lockbox create "xtoken" "4,$XSYMBOL" "eosio.token" "4,$SYMBOL"
adapter create "xtoken" "4,$XSYMBOL" "eosio.token" "4,$SYMBOL" "$SYMBOL_BYTES" "$MIN_FEE"
adapter setfeemanagr "feesmanager"

eosio.token owner@active issue owner "100.0000 WRAM"
eosio.token owner@active transfer owner user "10.0000 WRAM"

echo "Done!"