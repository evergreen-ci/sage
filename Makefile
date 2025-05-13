SHELL= /bin/bash
include .env

REGISTRY=795250896452.dkr.ecr.us-east-1.amazonaws.com/skunkworks/${APP}
COMMIT_SHA=git-$(shell git rev-parse --verify HEAD | cut -c1-7)
HELM_CMD = helm --kube-context=api.staging.corp.mongodb.com --namespace=skunkworks
HELM_UPGRADE = $(HELM_CMD) upgrade \
					 --install \
					 --version=4.17.3 \
					 --values=./environments/staging.yaml \
					 --set="image.tag=${COMMIT_SHA},image.repository=${REGISTRY}" \
					 --debug \
					 ${APP} mongodb/web-app

context:  ## Set the kubectl context to staging cluster and skunkworks namespace
	kubectl config use-context api.staging.corp.mongodb.com
	kubectl config set-context api.staging.corp.mongodb.com --namespace=skunkworks

login: ## Login to the AWS ECR for skunkworks. Login is valid for 12 hours
	./scripts/ecr-login.sh
	
create: login ## Creates your ECR docker repository
	./scripts/ecr-create.sh

.PHONY: build
build: ## Build and tag your docker container
	docker build -t ${APP} .
	docker tag ${APP} ${REGISTRY}:${COMMIT_SHA}

.PHONY: push
push: build ## Push the image to skunkworks ECR
	docker push ${REGISTRY}:${COMMIT_SHA}

.PHONY: helm-repo ## Update local cache of mongodb helm charts
helm-repo:
	helm repo add mongodb https://10gen.github.io/helm-charts
	helm repo update mongodb

.PHONY: dry-run
dry-run: helm-repo ## Outputs a manifest of resources to be deployed without making any changes.
	$(HELM_UPGRADE) --dry-run

.PHONY: install
install: helm-repo ## Install/upgrade deployment via helm
	$(HELM_UPGRADE)

.PHONY: delete
delete:
	$(HELM_CMD) delete --namespace=skunkworks ${APP}

## Useful playlists
.PHONY: all
all: ## Build, push, and install
	$(MAKE) push
	$(MAKE) install

.PHONY: run
run: build ## Locally run the docker container
	docker run -p 8080:8080 -e MONGO_URL=${MONGO_URL} -e MONGO_USERNAME=${MONGO_USERNAME} -e MONGO_PASSWORD=${MONGO_PASSWORD} ${APP}