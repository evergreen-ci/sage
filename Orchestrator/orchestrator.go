package orchestrator

import (
	"context"
	"encoding/json"
	"evergreen-ai-service/config"
	"evergreen-ai-service/openaiservice"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"go.uber.org/zap"
)

var MAX_ORCHESTRATOR_ITERATIONS int = 5

func RunOrchestrationWithNativeTools(ctx context.Context, messages []azopenai.ChatRequestMessageClassification) (string, error) {
	orchestratorIteration := 0
	shouldEndOrchestration := false
	for orchestratorIteration < MAX_ORCHESTRATOR_ITERATIONS && !shouldEndOrchestration {
		orchestratorIteration++
		resp, err := openaiservice.GetOpenAICompletion(messages, toolDefinitions)
		if err != nil {
			return "", fmt.Errorf("initial completion error")
		}
		if len(resp.Choices) > 0 {
			responseMessage := resp.Choices[0].Message
			// config.Logger.Info("Response message", zap.String("content", *responseMessage.Content))
			if len(responseMessage.ToolCalls) == 0 {
				// No tool calls, just return the content
				return *responseMessage.Content, nil
			}
			if len(responseMessage.ToolCalls) > 0 {
				messages = append(messages, &azopenai.ChatRequestAssistantMessage{
					ToolCalls: responseMessage.ToolCalls,
				})
				for _, toolCall := range responseMessage.ToolCalls {
					fn := toolCall.(*azopenai.ChatCompletionsFunctionToolCall).Function
					argumentsObj := map[string]any{}

					err = json.Unmarshal([]byte(*fn.Arguments), &argumentsObj)
					if err != nil {
						fmt.Printf("Could not unmarshal arguments: %s", err)
						return "", err
					}

					config.Logger.Info("Tool call", zap.String("tool", *fn.Name), zap.String("args", string(*fn.Arguments)))
					handler, err := validateTool(*fn.Name)
					if err != nil {
						return "", fmt.Errorf("tool validation error: %w", err)
					}
					result, err := handler(argumentsObj)
					if err != nil {
						return "", fmt.Errorf("tool execution failed: %w", err)
					}

					resultJSON, _ := json.Marshal(ToolResult{
						Tool:    *fn.Name,
						Results: result,
					})

					toolMessage := &azopenai.ChatRequestToolMessage{
						Content:    azopenai.NewChatRequestToolMessageContent(string(resultJSON)),
						ToolCallID: toolCall.GetChatCompletionsToolCall().ID,
					}
					messages = append(messages, toolMessage)
					if isEndOrchestrationTool(*fn.Name) {
						// End orchestration
						config.Logger.Info("Ending orchestration")
						shouldEndOrchestration = true
					}
				}
			}
		}
	}

	finalResp, err := openaiservice.GetOpenAICompletion(messages, nil)
	if err != nil {
		return "", fmt.Errorf("final completion error: %w", err)
	}

	finalMsg := finalResp.Choices[0].Message
	return *finalMsg.Content, nil
}

func toPtr[T any](v T) *T {
	return &v
}
