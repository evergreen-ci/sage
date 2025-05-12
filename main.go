package main

import (
	"bufio"
	"context"
	"net/http"
	"os"
	"strings"
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

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		logger.Fatal("Error opening .env file", zap.Error(err))
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || len(strings.TrimSpace(line)) == 0 {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
	if err := scanner.Err(); err != nil {
		logger.Fatal("Error reading .env file", zap.Error(err))
	}
}

func loadConfig() {
	loadEnv()
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
	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/", helloHandler)

	router.POST("/parsley_ai", OpenAIGinHandler)

	router.Run("localhost:8080")
}
