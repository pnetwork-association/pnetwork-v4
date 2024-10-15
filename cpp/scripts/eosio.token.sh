#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"

function get_create_params {
    local json
    local issuer
    local max_supply

    issuer=$1
    maximum_supply=$2

    add_key_value_string json "$json" "issuer" "$issuer"
    add_key_value_string json "$json" "maximum_supply" "$maximum_supply"

    echo "$json"
}

function get_json_params {
    local action
    local params
    action=$1
    shift 1

    case $action in

    create) get_create_params "$@" ;;

    *) invalid_action "$action" ;;
    esac
}

function eosio.token {
    local action
    local permission
    local default
    local contract
    local json

    contract=$FUNCNAME

    contract_script_init action permission "$contract" "$@"

    shift 1 # skip the action name

    json=$(get_json_params "$action" "$@")

    # If it's empty, it means an error happened, so better stop
    # here, otherwise it ends up in the push action call
    if [[ -z "$json" ]]; then exit 1; fi

    # We call the action
    push_action "$contract" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    eosio.token "$@"
fi