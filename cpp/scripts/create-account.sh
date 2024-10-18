#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function create_account {
    local account
    local wallet
    local pubkey
    local keypath

    account="$1"
    wallet="$2"

    exit_if_empty "$account" "Account name is required"
    exit_if_empty "$wallet" "wallet name is required"

    keypath="$FOLDER_EOS_DATA/$wallet.key"
    pubkey=$(get_pubkey "$keypath")

    cleos create account eosio "$account" "$pubkey"
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Creating account..."
    create_account "$@"
    echo "Done!"
fi