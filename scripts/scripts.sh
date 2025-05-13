#!/bin/bash

which brew || (echo "Homebrew required." && exit 1)

# base kanopy dependencies and tools
which kubectl || brew install kubectl
which helm || brew install helm

# install ksec, useful for managing secreets in k8s (kubernetes)
helm ksec > /dev/null || (helm plugin install https://github.com/kanopy-platform/ksec)