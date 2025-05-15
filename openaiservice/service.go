package openaiservice

import (
	"context"
	"evergreen-ai-service/config"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"go.uber.org/zap"
)

var OpenAIClient *azopenai.Client
var ModelDeploymentName string

func InitOpenAIClient() error {
	if config.Config.OpenAIKey == "" {
		// Return an error if the key is not set
		return fmt.Errorf("OPENAI_KEY is not set")
	}
	config.Logger.Info("Initializing OpenAI OpenAIClient")
	config.Logger.Info("OpenAI key", zap.String("key", config.Config.OpenAIKey))
	config.Logger.Info("OpenAI endpoint", zap.String("endpoint", config.Config.OpenAIEndpoint))
	keyCredential := azcore.NewKeyCredential(config.Config.OpenAIKey)
	ModelDeploymentName = "gpt-4.1"
	var err error
	OpenAIClient, err = azopenai.NewClientWithKeyCredential(config.Config.OpenAIEndpoint, keyCredential, nil)
	if err != nil {
		config.Logger.Error("Failed to create OpenAI OpenAIClient", zap.Error(err))
	}

	return nil
}

func GetOpenAICompletion(messages []azopenai.ChatRequestMessageClassification, tools []azopenai.ChatCompletionsToolDefinitionClassification) (*azopenai.GetChatCompletionsResponse, error) {
	chatCompletion, err := OpenAIClient.GetChatCompletions(context.TODO(), azopenai.ChatCompletionsOptions{
		Messages:       messages,
		DeploymentName: &ModelDeploymentName,
		Tools:          tools,
	}, nil)

	if err != nil || len(chatCompletion.Choices) == 0 {
		config.Logger.Error("Failed to get response from OpenAI", zap.Error(err))
		return nil, err
	}

	config.Logger.Info("OpenAI usage: ", zap.String("usage: ", fmt.Sprintf("Total Tokens: %d, Prompt Tokens: %d, Completion Tokens: %d, Total Cost $%.6f", *chatCompletion.Usage.TotalTokens, *chatCompletion.Usage.PromptTokens, *chatCompletion.Usage.CompletionTokens, calculateCost(chatCompletion.Usage))))
	return &chatCompletion, nil

}

func calculateCost(usage *azopenai.CompletionsUsage) float64 {
	// Assuming the cost is $2 per 1M tokens for the model
	costPerInputToken := 2.0 / 1000000.0
	// Assuming the cost is $8 per 1M tokens for the output
	costPerOutputToken := 8.0 / 1000000.0

	costForInput := float64(*usage.PromptTokens) * costPerInputToken
	costForOutput := float64(*usage.CompletionTokens) * costPerOutputToken
	costTotal := costForInput + costForOutput

	return float64(costTotal)
}
