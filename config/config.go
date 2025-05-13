package config

import (
	"os"
	"sync"

	"go.uber.org/zap"
)

type AppConfig struct {
	OpenAIKey      string
	OpenAIEndpoint string

	MongoURL       string
	MongoUsername  string
	MongoPassword  string
	AllowedOrigins string
	AllowedHeaders string
}

var (
	Config AppConfig
	Logger *zap.Logger
	once   sync.Once
)

func Load() {
	once.Do(func() {
		Logger, _ = zap.NewProduction()
		Config = AppConfig{
			OpenAIKey:      os.Getenv("OPENAI_KEY"),
			OpenAIEndpoint: os.Getenv("OPENAI_ENDPOINT"),
			MongoURL:       os.Getenv("MONGO_URL"),
			MongoUsername:  os.Getenv("MONGO_USERNAME"),
			MongoPassword:  os.Getenv("MONGO_PASSWORD"),
			AllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
			AllowedHeaders: os.Getenv("CORS_ALLOWED_HEADERS"),
		}
	})
}
