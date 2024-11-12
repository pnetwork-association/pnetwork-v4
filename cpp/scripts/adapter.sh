#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"

function adapter.get_create_params {
    local __output
    local _output
    local xerc20
    local xerc20_symbol
    local token
    local token_symbol
    local token_bytes
    local min_fee

    __output="$1"
    shift 1

    xerc20="$1"
    xerc20_symbol="$2"
    token="$3"
    token_symbol="$4"
    token_bytes="$5"
    min_fee="$6"

    exit_if_empty "$xerc20" "xerc20 parameter is missing"
    exit_if_empty "$xerc20_symbol" "xerc20_symbol parameter is missing"
    exit_if_empty "$token" "token parameter is missing"
    exit_if_empty "$token_symbol" "token_symbol parameter is missing"
    exit_if_empty "$token_bytes" "token_bytes parameter is missing"
    exit_if_empty "$min_fee" "min_fee parameter is missing"

    add_key_value_string _output "$_output" "xerc20" "$xerc20"
    add_key_value_string _output "$_output" "xerc20_symbol" "$xerc20_symbol"
    add_key_value_string _output "$_output" "token" "$token"
    add_key_value_string _output "$_output" "token_symbol" "$token_symbol"
    add_key_value_string _output "$_output" "token_bytes" "$token_bytes"
    add_key_value_string _output "$_output" "min_fee" "$min_fee"

    eval "$__output"="'$_output'"
}

function adapter.get_settle_params {
    local __output
    local _output
    local caller
    local operation
    local metadata

    __output="$1"
    shift 1
    caller="$1"
    operation="$2"
    metadata="$3"

    exit_if_empty "$caller" "caller param is missing"
    exit_if_empty "$operation" "operation param is missing"
    exit_if_empty "$metadata" "metadata param is missing"

    add_key_value_string _output "$_output" "caller" "$caller"
    add_key_value_string _output "$_output" "operation" "$operation" # FIXME: custom parsing?
    add_key_value_string _output "$_output" "metadata" "$metadata"   # FIXME: custom parsing?
}

function adapter.get_setfeemanagr_params {
    local __output
    local _output
    local fee_manager

    __output="$1"
    shift 1
    fee_manager="$1"

    exit_if_empty "$fee_manager" "fee_manager param is missing"

    add_key_value_string _output "$_output" "fee_manager" "$fee_manager"

    eval "$__output"="'$_output'"
}

function adapter.get_adduserdata_params {
    local __output
    local _output
    local caller
    local payload # FIXME: bytes

    __output="$1"
    shift 1

    caller="$1"
    payload="$2"

    exit_if_empty "$caller" "caller param is missing"
    exit_if_empty "$payload" "payload param is missing"

    add_key_value_string _output "$_output" "caller" "$caller"
    add_key_value_string _output "$_output" "payload" "$payload" # FIXME?: bytes

    eval "$__output"="'$_output'"
}

function adapter.get_freeuserdata_params {
    local __output
    local _output
    local account

    __output="$1"
    shift 1

    account=$1

    exit_if_empty "$account" "account param is missing"

    add_key_value_string _output "$_output" "account" "$account"

    eval "$__output"="'$_output'"
}

function adapter.get_json_params {
    local __params # output
    local action
    __params=$1
    action="$2"
    shift 2

    # NOTE: what do we return here? __params will get
    # the value in the eval inside get_xxx_params function
    case "$action" in

    create) adapter.get_create_params "$__params" "$@" ;;

    settle) adapter.get_settle_params "$__params" "$@" ;;

    setfeemanagr) adapter.get_setfeemanagr_params "$__params" "$@" ;;

    adduserdata) adapter.get_adduserdata_params "$__params" "$@" ;;

    freeuserdata) adapter.get_freeuserdata_params "$__params" "$@" ;;

    *) invalid_action "$action" ;;
    esac
}

function adapter {
    local action
    local permission
    local shifting_pos
    local contract_name
    local json

    contract_name="$1"
    shift 

    contract_script_init action permission shifting_pos "$contract_name" "$@"

    shift "$shifting_pos"

    adapter.get_json_params json "$action" "$@"

    # We call the action
    push_action "$contract_name" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    adapter "$@"
fi