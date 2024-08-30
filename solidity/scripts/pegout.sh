#!/bin/bash

show_usage() {
    echo "Usage:"
    echo "$(basename "$0") <recipient> <token-address> <amount>"
}

if [[ -z "$1" ]]; then
    echo "Invalid recipient"
    show_usage
    exit 1
fi

if [[ -z "$2" ]]; then
    echo "Invalid token-address"
    show_usage
    exit 1
fi

if [[ -z "$3" ]]; then
    echo "Invalid amount"
    show_usage
    exit 1
fi

cast calldata "pegOut(address,address,uint256)" "$1" "$2" "$3"