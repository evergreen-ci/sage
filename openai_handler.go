package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/gin-gonic/gin"

	"go.uber.org/zap"
)

var client *azopenai.Client
var modelDeploymentName string
var systemMessage string

func InitOpenAIClient() error {
	if config.OPENAI_KEY == "" {
		// Return an error if the key is not set
		return fmt.Errorf("OPENAI_KEY is not set")
	}
	logger.Info("Initializing OpenAI client")
	logger.Info("OpenAI key", zap.String("key", config.OPENAI_KEY))
	logger.Info("OpenAI endpoint", zap.String("endpoint", config.OPENAI_ENDPOINT))
	keyCredential := azcore.NewKeyCredential(config.OPENAI_KEY)
	modelDeploymentName = "gpt-4.1"
	promptBuffer, err := os.ReadFile("prompts/parsley_system_prompt.md")
	if err != nil {
		logger.Error("Failed to read system message file", zap.Error(err))
		panic(err)
	}
	systemMessage = string(promptBuffer)
	client, err = azopenai.NewClientWithKeyCredential(config.OPENAI_ENDPOINT, keyCredential, nil)
	if err != nil {
		logger.Error("Failed to create OpenAI client", zap.Error(err))
	}

	return nil
}

func OpenAIGinHandler(c *gin.Context) {
	var req struct {
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	messages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(systemMessage),
		},
		&azopenai.ChatRequestUserMessage{
			Content: azopenai.NewChatRequestUserMessageContent(req.Message),
		},
	}
	chatCompletion, err := client.GetChatCompletions(context.TODO(), azopenai.ChatCompletionsOptions{
		Messages:       messages,
		DeploymentName: &modelDeploymentName,
	}, nil)

	if err != nil || len(chatCompletion.Choices) == 0 {
		logger.Error("Failed to get response from OpenAI", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response from OpenAI"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"response": chatCompletion.Choices[0].Message.Content})
}
