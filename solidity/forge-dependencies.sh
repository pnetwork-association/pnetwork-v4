#!/bin/bash

ls lib/ | \
xargs -I % bash -c \
'cat ./lib/%/package.json' | jq -r '.version as $version | .repository.url|scan("([a-z-]+.git)") | @text "\(.[0])@\($version)"'
