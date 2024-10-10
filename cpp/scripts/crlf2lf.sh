#!/bin/bash

# This scripts is used to replace
# windows new lines (CRLF) to linux
# new lines (LF). Otherwise fuckyea
# index.js can't be loaded
sed -i 's/\r$//' $1