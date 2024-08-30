#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))
$dir_name/Script.sh "ERC20.s.sol" "$@"