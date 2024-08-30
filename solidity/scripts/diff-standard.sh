#!/bin/bash

if [ $# -eq 0 ]; then
    echo "This is useful to compare current XERC20* contracts"
    echo "changes against upstream."
    echo ""
    echo "Usage: ./$(basename $0) <contract-path>"
    exit 1
fi

# abs_dir=$(dirname $(realpath $BASH_SOURCE))
contract=$(basename $1)
curl -s "https://raw.githubusercontent.com/connext/xERC20/main/solidity/contracts/$contract" \
    | diff -u --color - "$1"