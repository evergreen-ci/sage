# Evergreen AI Service

This is a Go-based web server and AI assistant for Evergreen CI and log viewing.
It supports local development, Docker, and deployment to Kubernetes via Helm.

## Getting Started

### Prerequisites

- Go 1.18 or newer (recommended: Go 1.24+)
- Docker
- Make
- (Optional) Helm, kubectl, and AWS CLI for deployment

### Setup

1. **Clone the repository**
   ```sh
   git clone <your-repo-url>
   cd evergreen-ai-service
   ```
2. **Create a `.env` file**
   ```sh
   cp .env.example .env
   # or manually create and fill in required secrets
   ```
3. **Install Go dependencies**
   ```sh
   go mod tidy
   ```

## Running Locally

### With Go

```sh
make run-local
```

### With Docker

Build and run the container locally:

```sh
make run
```

This will build the Docker image and run it, exposing port 8080.

## Makefile Commands

- `make run-local` – Run the server directly with Go (for development)
- `make run` – Build and run the Docker container locally
- `make build` – Build and tag the Docker image
- `make push` – Push the Docker image to ECR
- `make install` – Deploy/update the app in Kubernetes via Helm
- `make dry-run` – Output a manifest of resources to be deployed (no changes)
- `make delete` – Remove the deployment from Kubernetes
- `make all` – Build, push, and install in sequence
- `make login` – Login to AWS ECR
- `make create` – Create the ECR repository
- `make helm-repo` – Update local cache of MongoDB Helm charts
- `make context` – Set kubectl context to staging

## Environment Variables

Set these in your `.env` file as needed:

- `SECRET` – App secret
- `MONGO_URL`, `MONGO_USERNAME`, `MONGO_PASSWORD` – MongoDB connection
- `OPENAI_API_KEY` – For OpenAI integration
- `CORS_ALLOWED_ORIGINS`, `CORS_ALLOWED_HEADERS` – CORS configuration
- `APP` – Name of the app for Docker/Helm

## Project Structure

- `main.go` – Entry point
- `config/` – Global config and logger
- `openaiservice/` – OpenAI service integration
- `Orchestrator/` – Orchestration logic
- `evergreen/` – Evergreen API integration
- `prompts/` – System prompts and recipes
- `environments/` – Deployment configs
- `scripts/` – Helper scripts for ECR, secrets, etc.

## Example Request

```sh
curl http://localhost:8080/
```

## Parsley AI Endpoint

The `/parsley_ai` route provides AI-powered assistance for debugging Evergreen
CI tasks using the Parsley assistant. This endpoint leverages system prompts and
tools to help users analyze logs and resolve issues.

### Example Request

Send a POST request to `/parsley_ai` with a JSON body containing your message or
task details:

```sh
curl -X POST http://localhost:8080/parsley_ai \
  -H 'Content-Type: application/json' \
  -d '{"message": "Help me debug task 12345 on execution 1"}'
```

The response will include AI-generated suggestions or debugging steps based on
the provided input.

---

Feel free to modify and extend this project as needed!
