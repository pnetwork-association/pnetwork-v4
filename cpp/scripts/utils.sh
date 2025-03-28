#!/bin/bash

function raise {
    >&2 echo "$1"
    exit 1
}
function abort_if_nodeos_in_background {
    if pgrep -x nodeos > /dev/null; then
        echo "Already found nodeos in the background, aborting..."
        exit 1
    fi
}

function exit_if_empty {
    if [[ -z "$1" ]]; then echo "$2"; exit 1; fi;
}

function get_privkey {
    local keypath
    keypath=$1
    grep -i private "$keypath" | awk '{print $3}'
}

function get_pubkey {
    local keypath
    keypath=$1
    grep -i public "$keypath" | awk '{print $3}'
}

function is_permission {
    grep -P '^[a-z]+\@(active|owner)$' <<< "$1" > /dev/null
}

function get_permission {
    if is_permission "$1"; then
        echo "$1"
    else
        echo "$2"
    fi
}

function log_contract_details {
    local contract
    local action
    local permission
    local params

    contract="$1"
    action="$2"
    permission="$3"
    shift 3
    params="$*"
    echo "====== $contract ====== "
    echo "action:     $action"
    echo "permission: $permission"
    echo "params:     $params"
    echo "----------------------- "
}

function invalid_action {
    raise "Action '$1' not implemented!"
}

function check_cmd_exists {
    if ! command -v "$1" >/dev/null 2>&1; then
        raise "$1 not installed!"
    fi
}

function add_key_value {
    local __json
    local _json
    local type
    local key
    local value

    type="$1"
    __json="$2"
    _json="$3"
    key="$4"
    value="$5"

    if [[ -z "$_json" ]]; then _json="{}"; fi

    case "$type" in

    string) _json=$(jq -ce ". += { \"$key\": \"$value\" }" <<< "$_json") ;;

    number) _json=$(jq -ce ". += {\"$key\": $value }" <<< "$_json") ;;

    *) raise "Invalid type" ;;

    esac

    # shellcheck disable=SC2181
    if [[ $? -gt 0 ]]; then
        _json=""
        raise "Failed to add string '$value' to \"$key\""
    fi

    eval "$__json"="'$_json'"
}

function add_key_value_string {
    add_key_value "string" "$@"
}

function add_key_value_number {
    add_key_value "number" "$@"
}