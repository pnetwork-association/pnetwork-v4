#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"
source "$dir_name/contract-script.sh"
source "$dir_name/push-action.sh"

# TODO: wire up the following functions
# function feesmanager.get_setallowance_params {
#     local __output
#     local _output
#     local node
#     local token
#     local value

#     __output="$1"
#     shift 1

#     eval "$__output"="'$_output'"
# }

# function feesmanager.get_incallowance_params {
#     local __output
#     local _output
#     local node
#     local token
#     local value

#     __output="$1"
#     shift 1

#     eval "$__output"="'$_output'"
# }

# function feesmanager.get_withdrawto_params {
#     local __output
#     local _output
#     local node
#     local token
#     local token_symbol

#     __output="$1"
#     shift 1

#     eval "$__output"="'$_output'"
# }

# function feesmanager.get_withdrawto_params {
#     local __output
#     local _output
#     local node
#     local tokens # FIXME: std::vector<name>&
#     local token_symbols # FIXME: std::vector<name>&

#     __output="$1"
#     shift 1

#     eval "$__output"="'$_output'"
# }

# function feesmanager.get_json_params {
#     local __params # output
#     local action
#     __params=$1
#     action="$2"
#     shift 2

#     # NOTE: what do we return here? __params will get
#     # the value in the eval inside get_xxx_params function
#     case "$action" in

#     create) feesmanager.get_create_params "$__params" "$@" ;;

#     *) invalid_action "$action" ;;
#     esac
# }

function feesmanager {
    local action
    local permission
    local shifting_pos
    local contract_name
    local json

    contract_name="$1"
    shift

    contract_script_init action permission shifting_pos "$contract_name" "$@"

    shift "$shifting_pos"

    feesmanager.get_json_params json "$action" "$@"

    # We call the action
    push_action "$contract_name" "$action" "$json" "--permission" "$permission"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    feesmanager "$@"
fi