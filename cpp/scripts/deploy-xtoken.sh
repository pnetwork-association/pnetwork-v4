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

# creat local wallets and import accounts
echo "Creating owner wallet"
cleos wallet create -n "owner" --to-console
echo "Importing xtoken account"
cleos wallet import -n "owner" --private-key "$XTOKEN_PK_A"
echo "Importing adapter account"
cleos wallet import -n "owner" --private-key "$ADAPTER_PK_A"
echo "Importing lockbox account"
cleos wallet import -n "owner" --private-key "$LOCKBOX_PK_A"
echo "Creating feesmanager wallet"
cleos wallet create -n "feesmanager" --to-console
echo "Importing feesmanager account"
cleos wallet import -n "feesmanager" --private-key "$FEESMANAGER_PK_A"

# deploy contracts
echo "Deploying adapter using --$ADAPTER_NAME-- account ..."
deploy adapter "$ADAPTER_NAME" 
add_code_permissions "$ADAPTER_NAME" 
if $IS_LOCAL; then
  echo "Deploying lockbox using --$LOCKBOX_NAME-- account ..."
  deploy lockbox "$LOCKBOX_NAME" 
  add_code_permissions "$LOCKBOX_NAME" 
fi
echo "Deploying feesmanager using --$FEESMANAGER_NAME-- account ..."
deploy feesmanager "$FEESMANAGER_NAME" 
echo "Deploying xtoken using --$XTOKEN_NAME-- account ..."
deploy xerc20.token "$XTOKEN_NAME" 

echo "Setup xtoken parameters"
XSYMBOL="X$UNDERLYING_SYMBOL"
MINTING_LIMIT="$MINT_LIMIT $XSYMBOL"
BURNING_LIMIT="$BURN_LIMIT $XSYMBOL"
MIN_FEE="$MIN_FEE $XSYMBOL"

# setup the bridge
xerc20.token "$XTOKEN_NAME" "$XTOKEN_NAME"@action create "$OWNER_NAME" "$MAX_SUPPLY $XSYMBOL"
xerc20.token "$XTOKEN_NAME" setlimits "$ADAPTER_NAME" "$MINTING_LIMIT" "$BURNING_LIMIT" 

if $IS_LOCAL; then
  xerc20.token "$XTOKEN_NAME" setlockbox "$LOCKBOX_NAME" 
  lockbox "$LOCKBOX_NAME" create "$XTOKEN_NAME" "4,$XSYMBOL" "$UNDERLYING_NAME" "4,$UNDERLYING_SYMBOL" 
  adapter "$ADAPTER_NAME" create "$XTOKEN_NAME" "4,$XSYMBOL" "$UNDERLYING_NAME" "4,$UNDERLYING_SYMBOL" "$SYMBOL_BYTES" "$MIN_FEE" 
else
  adapter "$ADAPTER_NAME" create "$XTOKEN_NAME" "4,$XSYMBOL" "$UNDERLYING_NAME" "4,$UNDERLYING_SYMBOL" "$SYMBOL_BYTES" "$MIN_FEE"
fi
adapter "$ADAPTER_NAME" setfeemanagr "$FEESMANAGER_NAME" 

echo "Done!"