#!/bin/bash

ls lib/ | \
xargs -I % bash -c \
'cat ./lib/%/package.json' | jq -r '.version as $version | .repository.url|scan("([a-zA-Z0-9-]+.git)") | @text "\(.[0])@\($version)"' 2> /dev/null
