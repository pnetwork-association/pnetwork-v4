#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"

function get_table {
    cleos get table "$@"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_table "$@"
fi