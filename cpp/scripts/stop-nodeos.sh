#!/bin/bash

stop_nodeos() {
    if [[ -n $(pgrep nodeos) ]]; then
        pkill -x nodeos
    fi

}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Stopping nodeos..."
    stop_nodeos "$@"
    echo "Done!"
fi