#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"

function push_action {
    echo "cleos -u $NODEOSURL push action $*"
    cleos push action "$@"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    push_action "$@"
fi