#!/bin/bash

# Stop nodeos
pid=$(pidof nodeos)

if [[ -n "$pid" ]]; then kill $(pidof nodeos); fi
