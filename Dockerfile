FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build evergreen-ai-service .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/evergreen-ai-service .
RUN mkdir -p /app/prompts
COPY --from=builder /app/prompts/*.md /app/prompts/
EXPOSE 8080
CMD ["/app/evergreen-ai-service"]