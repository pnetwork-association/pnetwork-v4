#!/bin/bash

dir_name=$(dirname $(realpath $BASH_SOURCE))
$dir_name/Script.sh "Upgrade.s.sol" "$@"