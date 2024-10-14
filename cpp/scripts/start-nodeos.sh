#!/bin/bash
dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/utils.sh"

start_nodeos() {
    dir_data=$dir_name/eosio-data-dir
    wallet=test_wallet.pwd
    path_wallet=$dir_data/$wallet

    abort_if_nodeos_in_background

    # Run nodeos (https://developers.eos.io/manuals/eos/v2.1/nodeos/usage/development-environment/local-single-node-testnet-consensus)
    nodeos \
        --data-dir $dir_data \
        --config-dir $dir_name \
        --config config.ini \
        --delete-all-blocks > /dev/null 2>&1 &
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    start_nodeos "$@"
    echo "Done!"
fi