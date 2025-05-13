package openaiservice

import (
	"context"
	"evergreen-ai-service/config"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"go.uber.org/zap"
)

var client *azopenai.Client
var modelDeploymentName string

func InitOpenAIClient() error {
	if config.Config.OpenAIKey == "" {
		// Return an error if the key is not set
		return fmt.Errorf("OPENAI_KEY is not set")
	}
	config.Logger.Info("Initializing OpenAI client")
	config.Logger.Info("OpenAI key", zap.String("key", config.Config.OpenAIKey))
	config.Logger.Info("OpenAI endpoint", zap.String("endpoint", config.Config.OpenAIEndpoint))
	keyCredential := azcore.NewKeyCredential(config.Config.OpenAIKey)
	modelDeploymentName = "gpt-4.1"
	var err error
	client, err = azopenai.NewClientWithKeyCredential(config.Config.OpenAIEndpoint, keyCredential, nil)
	if err != nil {
		config.Logger.Error("Failed to create OpenAI client", zap.Error(err))
	}

	return nil
}

func GetOpenAICompletion(messages []azopenai.ChatRequestMessageClassification) (*azopenai.GetChatCompletionsResponse, error) {
	chatCompletion, err := client.GetChatCompletions(context.TODO(), azopenai.ChatCompletionsOptions{
		Messages:       messages,
		DeploymentName: &modelDeploymentName,
	}, nil)

	if err != nil || len(chatCompletion.Choices) == 0 {
		config.Logger.Error("Failed to get response from OpenAI", zap.Error(err))
		return nil, err
	}

	return &chatCompletion, nil

}
