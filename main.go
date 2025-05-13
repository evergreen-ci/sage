package main

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.uber.org/zap"
)

// Config holds secrets and configuration
type Config struct {
	OPENAI_KEY                  string
	OPENAI_ENDPOINT             string
	CENTRAL_RAG_API_KEY         string
	CENTRAL_RAG_OPENAI_BASE_URL string
	MONGO_URL                   string
	MONGO_USERNAME              string
	MONGO_PASSWORD              string
}

var config Config
var logger *zap.Logger

func initLogger() {
	var err error
	logger, err = zap.NewProduction()
	if err != nil {
		panic(err)
	}
}

func loadConfig() {
	config.OPENAI_KEY = os.Getenv("OPENAI_KEY")
	config.OPENAI_ENDPOINT = os.Getenv("OPENAI_ENDPOINT")
	config.MONGO_URL = os.Getenv("MONGO_URL")
	if config.MONGO_URL == "" {
		logger.Fatal("MONGO_URL not set in .env file")
	}
	config.MONGO_USERNAME = os.Getenv("MONGO_USERNAME")
	if config.MONGO_USERNAME == "" {
		logger.Fatal("MONGO_USERNAME not set in .env file")
	}
	config.MONGO_PASSWORD = os.Getenv("MONGO_PASSWORD")
	if config.MONGO_PASSWORD == "" {
		logger.Fatal("MONGO_PASSWORD not set in .env file")
	}
	clientOpts := options.Client().ApplyURI(config.MONGO_URL)
	clientOpts.SetAuth(options.Credential{
		Username: config.MONGO_USERNAME,
		Password: config.MONGO_PASSWORD,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		logger.Fatal("Error connecting to MongoDB", zap.Error(err))
	}

	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		logger.Fatal("Error pinging MongoDB", zap.Error(err))
	}
	logger.Info("Connected to MongoDB!")
}

func helloHandler(c *gin.Context) {
	c.IndentedJSON(http.StatusOK, gin.H{"status": "ok"})
}

func main() {
	initLogger()
	defer logger.Sync()
	loadConfig()
	err := InitOpenAIClient()
	if err != nil {
		logger.Fatal("Error initializing OpenAI client", zap.Error(err))
	}
	err = InitParsleySystemMessage()
	if err != nil {
		logger.Fatal("Error initializing system message", zap.Error(err))
	}
	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/", helloHandler)

	router.POST("/parsley_ai", ParsleyGinHandler)

	router.Run("localhost:8080")
}
