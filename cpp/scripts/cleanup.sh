#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/stop-nodeos.sh"

cleanup() {
    dir_data=$dir_name/eosio-data-dir
    wallet=test_wallet.pwd
    path_wallet=$dir_data/$wallet
    rm -rf $dir_data
    rm -rf $dir_name/protocol_features
    rm -f $HOME/eosio-wallet/test.wallet

    stop_nodeos
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Cleaning up..."
    cleanup "$@"
    echo "Done!"
fi