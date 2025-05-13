FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build evergreen-ai-service .
FROM alpine:3.19
WORKDIR /root/
COPY --from=builder /app/evergreen-ai-service .
EXPOSE 8080
CMD ["/root/evergreen-ai-service"]