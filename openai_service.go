package main

import (
	"context"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"go.uber.org/zap"
)

var client *azopenai.Client
var modelDeploymentName string

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
	var err error
	client, err = azopenai.NewClientWithKeyCredential(config.OPENAI_ENDPOINT, keyCredential, nil)
	if err != nil {
		logger.Error("Failed to create OpenAI client", zap.Error(err))
	}

	return nil
}

func GetOpenAICompletion(messages []azopenai.ChatRequestMessageClassification) (*azopenai.GetChatCompletionsResponse, error) {
	chatCompletion, err := client.GetChatCompletions(context.TODO(), azopenai.ChatCompletionsOptions{
		Messages:       messages,
		DeploymentName: &modelDeploymentName,
	}, nil)

	if err != nil || len(chatCompletion.Choices) == 0 {
		logger.Error("Failed to get response from OpenAI", zap.Error(err))
		return nil, err
	}

	return &chatCompletion, nil

}
