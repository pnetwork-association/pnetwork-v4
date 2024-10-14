#!/bin/bash

abort_if_nodeos_in_background() {
    if pgrep -x nodeos > /dev/null; then
        echo "Already found nodeos in the background, aborting..."
        exit 1
    fi
}