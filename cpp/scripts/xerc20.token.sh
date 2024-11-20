#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"
source "$dir_name/eosio.token.sh"

function xerc20.token.get_setlimits_params {
    local __output
    local _output
    local bridge
    local minting_limit
    local burning_limit

    __output=$1
    shift 1
    bridge="$1"
    minting_limit="$2"
    burning_limit="$3"

    exit_if_empty "$bridge" "bridge account parameter is missing"
    exit_if_empty "$minting_limit" "minting_limit asset parameter is missing"
    exit_if_empty "$burning_limit" "burning_limit asset parameter is missing"

    add_key_value_string _output "$_output" "bridge" "$bridge"
    add_key_value_string _output "$_output" "minting_limit" "$minting_limit"
    add_key_value_string _output "$_output" "burning_limit" "$burning_limit"

    eval "$__output"="'$_output'"
}

function xerc20.token.get_setlockbox_params {
    local __output
    local _output
    local account

    __output=$1
    shift 1

    account="$1"

    exit_if_empty "$account" "account parameter is missing"

    add_key_value_string _output "$_output" "account" "$account"

    eval "$__output"="'$_output'"
}

function xerc20.token.get_json_params {
    local __params # output
    local action
    __params=$1
    action="$2"
    shift 2

    # NOTE: what do we return here? __params will get
    # the value in the eval inside get_xxx_params function
    case "$action" in

    create) eosio.token.get_create_params "$__params" "$@" ;;

    transfer) eosio.token.get_transfer_params "$__params" "$@" ;;

    setlimits) xerc20.token.get_setlimits_params "$__params" "$@" ;;

    setlockbox) xerc20.token.get_setlockbox_params "$__params" "$@" ;;

    *) invalid_action "$action" ;;
    esac
}

function xerc20.token {
    local action
    local permission
    local shifting_pos
    local contract_name
    local json

    contract_name=$1
    shift

    contract_script_init action permission shifting_pos "$contract_name" "$@"

    shift "$shifting_pos"

    xerc20.token.get_json_params json "$action" "$@"

    # We call the action
    push_action "$contract_name" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    xerc20.token "$@"
fi