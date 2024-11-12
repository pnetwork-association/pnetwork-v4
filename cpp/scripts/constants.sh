#!/bin/bash

dir_name=$(dirname "$(realpath "${BASH_SOURCE[0]}")")

export FILE_ENV="$dir_name/../.env"

source "$FILE_ENV"

# Endpoint
shopt -s expand_aliases
alias cleos="cleos -u \$NODEOSURL"

# Constants
export FOLDER_EOS_DATA=eosio-data-dir
export DIR_DATA="$dir_name/$FOLDER_EOS_DATA"
export FOLDER_BUILD="$dir_name/../contracts/build"