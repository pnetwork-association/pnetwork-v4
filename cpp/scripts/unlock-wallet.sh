#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function unlock_wallet {
    local pwd
    local name

    name="$1"

    exit_if_empty "$name" "Wallet name is required"

    pwd=$(cat "$FOLDER_EOS_DATA/$name.pwd")

    exit_if_empty "$pwd" "Password not found for wallet $name"

    cleos wallet unlock --password "$pwd" -n "$name"
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Unlocking wallet..."
    unlock_wallet "$@"
fi