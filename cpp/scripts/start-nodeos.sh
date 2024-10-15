#!/bin/bash
dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function start_nodeos {
    local dir_data
    dir_data="$dir_name/$FOLDER_EOS_DATA"

    abort_if_nodeos_in_background

    # Run nodeos (https://developers.eos.io/manuals/eos/v2.1/nodeos/usage/development-environment/local-single-node-testnet-consensus)
    nodeos \
        --data-dir "$dir_data" \
        --config-dir "$dir_name" \
        --config config.ini \
        --delete-all-blocks > /dev/null 2>&1 &
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    start_nodeos "$@"
    echo "Done!"
fi