FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ws-proxy .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/ws-proxy /usr/local/bin/ws-proxy
EXPOSE 8080
CMD ["ws-proxy"]
