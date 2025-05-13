package main

import (
	"net/http"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

var systemMessage string

func InitParsleySystemMessage() error {
	promptBuffer, err := os.ReadFile("prompts/parsley_system_prompt.md")
	if err != nil {
		logger.Error("Failed to read system message file", zap.Error(err))
		return err
	}
	systemMessage = string(promptBuffer)
	return nil
}

func ParsleyGinHandler(c *gin.Context) {
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
	chatCompletion, err := GetOpenAICompletion(messages)

	if err != nil || len(chatCompletion.Choices) == 0 {
		logger.Error("Failed to get response from OpenAI", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response from OpenAI"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"response": chatCompletion.Choices[0].Message.Content})
}
