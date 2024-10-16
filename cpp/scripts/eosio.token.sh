#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"

function get_create_params {
    local __output
    local _output
    local issuer
    local maximum_supply

    __output="$1"
    issuer="$2"
    maximum_supply="$3"

    exit_if_empty "$issuer" "issuer param missing"
    exit_if_empty "$maximum_supply" "maximum_supply param missing"

    add_key_value_string _output "$_output" "issuer" "$issuer"
    add_key_value_string _output "$_output" "maximum_supply" "$maximum_supply"

    eval "$__output"="'$_output'"
}

function get_issue_params {
    local __output
    local _output
    local to
    local quantity
    local memo

    __output="$1"
    to="$2"
    quantity="$3"
    memo="$4"

    exit_if_empty "$to" "to account missing"
    exit_if_empty "$quantity" "quantity asset missing"

    add_key_value_string _output "$_output" "to" "$to"
    add_key_value_string _output "$_output" "quantity" "$quantity"
    add_key_value_string _output "$_output" "memo" "$memo"

    eval "$__output"="'$_output'"
}

function get_json_params {
    local __params # output
    local action
    __params=$1
    action="$2"
    shift 2

    # NOTE: we pass the output (__params) over
    # here, it'll get a value in the first
    # eval in the function calls
    case "$action" in

    create) get_create_params "$__params" "$@" ;;

    issue) get_issue_params "$__params" "$@" ;;

    *) invalid_action "$action" ;;
    esac
}

function eosio.token {
    local action
    local permission
    local shifting_pos
    local contract
    local json

    contract="${FUNCNAME[0]}"

    contract_script_init action permission shifting_pos "$contract" "$@"

    shift "$shifting_pos"

    get_json_params json "$action" "$@"

    # We call the action
    push_action "$contract" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    eosio.token "$@"
fi