#!/bin/bash
set -e

REGISTRY="795250896452.dkr.ecr.us-east-1.amazonaws.com"
REPO_NAME="sage"
NAMESPACE="devprod-evergreen"
RELEASE_NAME="sage"
HELM_CHART="mongodb/web-app"
CHART_VERSION="4.31.0"
K8S_API_SERVER="https://api.staging.corp.mongodb.com"
STAGING_HOST="sage.devprod-evergreen.staging.corp.mongodb.com"
GIT_SHA=$(git rev-parse --short=7 HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="git-${GIT_SHA}-${TIMESTAMP}"
FULL_IMAGE="${REGISTRY}/devprod-evergreen/${REPO_NAME}"

echo "Starting deployment pipeline for commit ${GIT_SHA}..."
echo "Building and pushing Docker image..."

if [ -z "$ECR_ACCESS_KEY" ] || [ -z "$ECR_SECRET_KEY" ]; then
    echo "Error: ECR_ACCESS_KEY and ECR_SECRET_KEY must be set"
    echo "You can export them or use AWS CLI configuration"
    exit 1
fi

AWS_ACCESS_KEY_ID="$(helm ksec get ecr ecr_access_key)" AWS_SECRET_ACCESS_KEY="$(helm ksec get ecr ecr_secret_key)" \
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${REGISTRY}

echo "Building Docker image..."
docker build --platform linux/amd64 -t ${FULL_IMAGE}:${IMAGE_TAG} -t ${FULL_IMAGE}:latest .

echo "Pushing image to ECR..."
docker push ${FULL_IMAGE}:${IMAGE_TAG}
docker push ${FULL_IMAGE}:latest
echo "Docker image pushed successfully"
echo "Deploying to Kanopy..."
if [ -z "$STAGING_KUBERNETES_TOKEN" ]; then
    echo "Error: STAGING_KUBERNETES_TOKEN must be set"
    exit 1
fi

helm repo add mongodb https://10gen.github.io/helm-charts
helm repo update
kubectl config set-cluster staging --server=${K8S_API_SERVER}
kubectl config set-credentials staging --token=${STAGING_KUBERNETES_TOKEN}
kubectl config set-context staging --cluster=staging --user=staging
kubectl config use-context staging
echo "Deploying Helm chart..."
helm upgrade --install ${RELEASE_NAME} ${HELM_CHART} \
    --version ${CHART_VERSION} \
    --namespace ${NAMESPACE} \
    --create-namespace \
    --set image.tag=${IMAGE_TAG} \
    --set image.repository=${FULL_IMAGE} \
    --set ingress.enabled=true \
    --set "ingress.hosts[0]=${STAGING_HOST}" \
    --values environments/staging.yaml \

echo "Deployment complete!"
echo "To check deployment status:"
echo "kubectl get pods -n ${NAMESPACE} -l app=${RELEASE_NAME}"