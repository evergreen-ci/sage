#!/bin/bash
# module for getting secrets from k8s

skunkube="kubectl --context=api.staging.corp.mongodb.com --namespace=devprod-evergreen"
AWS_ACCESS_KEY_ID=$($skunkube get secret ecr -o jsonpath="{.data.ecr_access_key}" | base64 --decode && echo)
AWS_SECRET_ACCESS_KEY=$($skunkube get secret ecr -o jsonpath="{.data.ecr_secret_key}" | base64 --decode && echo)

echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY