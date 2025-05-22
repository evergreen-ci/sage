#!/bin/bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )


. $parent_path/secrets.sh
. $parent_path/../.env


aws ecr create-repository --repository-name devprod-evergreen/evergreen-ai-service