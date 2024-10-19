#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"

function lockbox.get_create_params {
    local __output
    local _output
    local xerc20
    local xerc20_symbol
    local token
    local token_symbol

    __output="$1"
    shift 1

    xerc20="$1"
    xerc20_symbol="$2"
    token="$3"
    token_symbol="$4"

    exit_if_empty "$xerc20" "xerc20 name parameter is missing"
    exit_if_empty "$xerc20_symbol" "xerc20_symbol parameter is missing"
    exit_if_empty "$token" "token name parameter is missing"
    exit_if_empty "$token_symbol" "token_symbol parameter is missing"


    add_key_value_string _output "$_output" "xerc20" "$xerc20"
    add_key_value_string _output "$_output" "xerc20_symbol" "$xerc20_symbol"
    add_key_value_string _output "$_output" "token" "$token"
    add_key_value_string _output "$_output" "token_symbol" "$token_symbol"

    eval "$__output"="'$_output'"
}

function lockbox.get_json_params {
    local __params # output
    local action
    __params=$1
    action="$2"
    shift 2

    # NOTE: what do we return here? __params will get
    # the value in the eval inside get_xxx_params function
    case "$action" in

    create) lockbox.get_create_params "$__params" "$@" ;;

    *) invalid_action "$action" ;;
    esac
}

function lockbox {
    local action
    local permission
    local shifting_pos
    local contract
    local json

    contract="${FUNCNAME[0]}"

    contract_script_init action permission shifting_pos "$contract" "$@"

    shift "$shifting_pos"

    lockbox.get_json_params json "$action" "$@"

    # We call the action
    push_action "$contract" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    lockbox "$@"
fi