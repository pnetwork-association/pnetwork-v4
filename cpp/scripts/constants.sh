#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))

export FILE_ENV="$dir_name/../.env"

source "$FILE_ENV"

# Constants
export FOLDER_EOS_DATA=eosio-data-dir
export DIR_DATA="$dir_name/$FOLDER_EOS_DATA"