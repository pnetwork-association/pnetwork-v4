#!/bin/bash

# Generates local lcov.info
forge clean && forge coverage \
    --skip \
        src/contracts/ptoken-v1/*.sol \
        src/contracts/ptoken-v1/*.sol \
        src/contracts/test/*.sol \
        test/forge/DeployHelper.sol \
        test/forge/Helper.sol \
    --report lcov

# Generate coverage/lcov.info
npx hardhat clean && FORK=1 npx hardhat coverage --solcoverjs .solcover.cjs

# Generate report
genhtml -o lcov lcov.info coverage/lcov.info

rm -r coverage lcov.info