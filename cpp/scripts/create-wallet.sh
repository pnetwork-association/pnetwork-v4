#!/bin/bash
dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function create_wallet {
    local name
    local keypath
    local privkey
    name="$1"
    keypath=$FOLDER_EOS_DATA/$name.key
    passpath=$FOLDER_EOS_DATA/$name.pwd

    mkdir -p "$FOLDER_EOS_DATA"

    exit_if_empty "$name" "Invalid wallet name"

    cleos create key -f $keypath
    cleos wallet create --name $name --file $passpath

    privkey=$(get_privkey "$keypath")

    cleos wallet import --name $name --private-key $privkey
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Creating wallet $1"
    create_wallet "$@"
    echo "Done!"
fi