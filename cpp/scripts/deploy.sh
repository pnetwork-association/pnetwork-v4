#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))

source "$dir_name/constants.sh"
source "$dir_name/utils.sh"

function usage {
    local b # bold
	local n # normal
	b=$(tput bold)
	n=$(tput sgr0)
	name=./$(basename $0)

	echo "${b}Usage:${n} $name <CONTRACT> [ACCOUNT]

    Deploy the contract to the specified account. If the account is
    not given, it will use the contract name as an account.

    ${b}Required arguments:${n}

    CONTRACT        the contract file name defined into the build folder
                    (i.e. eosio.token for eosio.token.wasm)

    ${b}Optional arguments:${n}

    ACCOUNT         The account where to deploy the selected contract code
                    (it will default to the given contract name)

    ${b}Notes:${n}

    You'll need to have the ACCOUNT permissions in order to deploy the contract.
    If that's not the case, you can create an account using the create-account.sh
    script.

    Also make sure the wallet associated with the account has been unlocked.

    ${b}Examples:${n}

    1. Deploy the eosio.token contract

        $name eosio.token

    2. Deploy the eosio.token contract to fun.token account

        $name eosio.token fun.token
    "

    exit 0
}

function deploy {
    local contract
    local account

    contract=$1

    exit_if_empty "$contract" "Contract name is required"

    account=${2:-$contract}

    cleos set contract $account $FOLDER_BUILD $contract.wasm $contract.abi -p $account@active
}


if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "$#" -lt 1 || $1 == "-h" || $1 == "--help" ]]; then
        usage
    fi

    echo "Deploying..."
    deploy "$@"
    echo "Done!"
fi