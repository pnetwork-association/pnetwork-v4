# Here's a wrapper for contract interaction
# Interface is injected through the interface parameter

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

# NOTE: looks complex but fear not:
# there are three outputs
#   1. action
#   2. permission
#   3. number of position to skip from the original args
# One underscors means the variable that will hold the value
# Two underscores means the reference to the output value passed
# from the caller
# Eval at the end will assign the value to the output reference
#
function contract_script_init {
    # Output vars
    local _action
    local __action
    local _permission
    local __permission
    local __shift
    local _shift

    local contract
    local default_permission

    __action="$1"
    __permission="$2"
    __shift="$3"
    contract="$4"
    default_permission="$contract@active"
    _permission="$5"
    _action="$5"
    _shift=1

    shift 5

    _permission=$(get_permission "$_permission" "$default_permission")

    # If a permission was found in the given args
    # the action is the next position
    if [[ "$_permission" != "$default_permission" ]]; then
        _action="$1"
        shift 1
        # NOTE: means permission + action name had been given
        # as parameters, so we skip both
        _shift=2
    fi

    exit_if_empty "$_action" "Action name parameter is required"

    log_contract_details "$contract" "$_action" "$_permission" "$@"

    eval "$__action"="'$_action'"
    eval "$__permission"="'$_permission'"
    eval "$__shift"="'$_shift'"
}