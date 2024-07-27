#!/bin/bash

# Generates local lcov.info
forge coverage --skip src/ptoken-v1/*.sol src/ptoken-v1/*.sol --report lcov

# Generate coverage/lcov.info
FORK=1 yarn hardhat coverage --solcoverjs .solcover.cjs

# Generate report
genhtml -o lcov lcov.info coverage/lcov.info

rm -r coverage lcov.info