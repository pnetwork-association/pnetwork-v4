#!/bin/bash

#
# Run once:
#   cd solidity
#   forge install
#
docker run -ti --entrypoint /bin/bash -v "$(pwd):/pnetwork-v4" enf
