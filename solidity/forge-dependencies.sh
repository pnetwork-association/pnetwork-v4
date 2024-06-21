#!/bin/bash

ls lib/ | \
xargs -I % bash -c \
'cat ./lib/%/package.json | jq -r "@text \"\(.name)@\(.version)\""'
