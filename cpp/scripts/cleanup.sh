#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/stop-nodeos.sh"

function cleanup {
    local dir_data
    dir_data="$dir_name/$FOLDER_EOS_DATA"
    echo "$dir_data"
    read -rp "This will erase all your local wallets, proceed? [Y/n] " answer
    if [[ "$answer" == "Y" || "$answer" == "y" ]]; then
        rm -rf "$dir_data"
        rm -rf "$dir_name/protocol_features"
        rm -rf "$HOME/eosio-wallet"
        stop_nodeos
    else
        echo "Aborted!"
        exit 0
    fi

}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Cleaning up..."
    cleanup "$@"
    echo "Done!"
fi