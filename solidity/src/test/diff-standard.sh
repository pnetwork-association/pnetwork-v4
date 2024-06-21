#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: ./$(basename $0) <contract>"
    exit 1
fi

curl -s "https://raw.githubusercontent.com/connext/xERC20/main/solidity/contracts/$1" \
    | sed  's/  /    /g' \
    | diff -u --color - "$1"