package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"strings"
	"github.com/gin-gonic/gin"
)

// Config holds secrets and configuration
type Config struct {
	Secret string `json:"secret"`
}

var config Config

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		log.Fatalf("Error opening .env file: %v", err)
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
		log.Fatalf("Error reading .env file: %v", err)
	}
}

func loadConfig() {
	loadEnv()
	config.Secret = os.Getenv("SECRET")
	if config.Secret == "" {
		log.Fatalf("SECRET not set in .env file")
	}
}

func helloHandler(c *gin.Context) {
	c.IndentedJSON(http.StatusOK, config)
}

func main() {
	loadConfig()
	router := gin.Default()
	router.GET("/", helloHandler)

	router.Run("localhost:8080")
}
