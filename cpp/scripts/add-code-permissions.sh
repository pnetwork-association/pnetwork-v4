#!/bin/bash

function add_code_permissions() {
    local account=$1

    exit_if_empty "$account" "account name is required"

    cleos set account permission "$account" active --add-code
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "$#" -lt 1 || $1 == "-h" || $1 == "--help" ]]; then
        usage
    fi

    echo "Adding code permissions to account..."
    add_code_permissions "$@"
    echo "Done!"
fi