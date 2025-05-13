#!/bin/bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
. $parent_path/secrets.sh

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 795250896452.dkr.ecr.us-east-1.amazonaws.com