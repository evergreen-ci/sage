package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.uber.org/zap"

	"evergreen-ai-service/config"
	"evergreen-ai-service/openaiservice"
)

var mongoClient *mongo.Client

func initMongo() error {
	if config.Config.MongoURL == "" {
		return fmt.Errorf("MONGO_URL is not set")
	}
	if config.Config.MongoUsername == "" {
		return fmt.Errorf("MONGO_USERNAME is not set")
	}
	if config.Config.MongoPassword == "" {
		return fmt.Errorf("MONGO_PASSWORD is not set")
	}

	clientOptions := options.Client().
		ApplyURI(config.Config.MongoURL).
		SetAuth(options.Credential{
			Username: config.Config.MongoUsername,
			Password: config.Config.MongoPassword,
		})

	var err error
	mongoClient, err = mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		return err
	}

	err = mongoClient.Ping(context.TODO(), readpref.Primary())
	if err != nil {
		return err
	}

	config.Logger.Info("MongoDB connection established")
	return nil
}

func loadEnv() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		config.Logger.Warn("Error loading .env file", zap.Error(err))
	}
}

func initService() {
	loadEnv()
	config.Load()
}

func helloHandler(c *gin.Context) {
	c.IndentedJSON(http.StatusOK, gin.H{"status": "ok"})
}

func main() {
	initService()
	defer config.Logger.Sync()
	err := initMongo()
	if err != nil {
		config.Logger.Fatal("Error initializing MongoDB", zap.Error(err))
		panic(err)
	}
	err = openaiservice.InitOpenAIClient()
	if err != nil {
		config.Logger.Fatal("Error initializing OpenAI client", zap.Error(err))
		panic(err)
	}
	err = InitParsleySystemMessage()
	if err != nil {
		config.Logger.Fatal("Error initializing system message", zap.Error(err))
		panic(err)
	}
	router := gin.Default()
	router.Use(cors.Default())
	router.GET("/", helloHandler)

	router.POST("/parsley_ai", ParsleyGinHandler)

	router.Run("localhost:8080")
}
