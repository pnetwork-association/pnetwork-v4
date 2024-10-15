# Here's a wrapper for contract interaction
# Interface is injected through the interface parameter

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function contract_script_init {
    # Output vars
    local _action
    local __action
    local _permission
    local __permission

    local contract
    local default_permission

    __action="$1"
    __permission="$2"
    contract="$3"
    default_permission="$contract@active"
    _permission="$4"
    _action="$4"

    shift 4

    _permission=$(get_permission "$_permission" "$default_permission")

    # If a permission was found in the given args
    # the action is the next position
    if [[ $_permission != "$default_permission" ]]; then
        # args=( ${@:5} )
        _action="$1"
        shift 1
    fi

    exit_if_empty "$_action" "Action name parameter is required"

    log_contract_details "$contract" "$_action" "permission" "$@"

    eval "$__action"="'$_action'"
    eval "$__permission"="'$_permission'"
}