#!/bin/bash

function abort_if_nodeos_in_background {
    if pgrep -x nodeos > /dev/null; then
        echo "Already found nodeos in the background, aborting..."
        exit 1
    fi
}

function exit_if_empty {
    if [[ -z "$1" ]]; then echo "$2"; exit 1; fi;
}
