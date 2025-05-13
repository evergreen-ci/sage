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

// // RunOrchestration executes the full orchestrator cycle for a user message
func RunOrchestration(ctx context.Context, messages []azopenai.ChatRequestMessageClassification) (string, error) {

	// Step 2: Get model response
	resp, err := openaiservice.GetOpenAICompletion(messages)
	if err != nil {
		return "", fmt.Errorf("initial completion error: %w", err)
	}

	modelMessage, err := cleanToolCallJSONStrings(*resp.Choices[0].Message.Content)
	if err != nil {
		return "", fmt.Errorf("message cleaning error: %w", err)
	}
	messageHasToolCall, err := validateIfMessageHasToolCall(modelMessage)
	if err != nil {
		return "", fmt.Errorf("message validation error: %w", err)
	}
	if messageHasToolCall {
		// Step 3: Parse tool call
		var toolCall ToolCall
		if err := json.Unmarshal([]byte(modelMessage), &toolCall); err != nil {
			fmt.Println(modelMessage)
			return "", fmt.Errorf("invalid tool call JSON: %w", err)
		}

		argsJSON, _ := json.Marshal(toolCall.Args)
		config.Logger.Info("Tool call", zap.String("tool", toolCall.Tool), zap.String("args", string(argsJSON)))
		handler, err := validateTool(toolCall.Tool)
		if err != nil {
			return "", fmt.Errorf("tool validation error: %w", err)
		}
		result, err := handler(toolCall.Args)
		if err != nil {
			return "", fmt.Errorf("tool execution failed: %w", err)
		}

		resultJSON, _ := json.Marshal(ToolResult{
			Tool:    toolCall.Tool,
			Results: result,
		})

		// This should be a tool message but I can't figure it out yet
		// toolMessage := &azopenai.ChatRequestToolMessage{
		// 	Content: azopenai.NewChatRequestToolMessageContent(string(resultJSON)),
		// }

		resultJsonString := string(resultJSON)
		toolMessage := &azopenai.ChatRequestFunctionMessage{
			Name:    toPtr(toolCall.Tool),
			Content: &resultJsonString,
		}
		messages = append(messages, toolMessage)

	}

	finalResp, err := openaiservice.GetOpenAICompletion(messages)
	if err != nil {
		return "", fmt.Errorf("final completion error: %w", err)
	}

	finalMsg := finalResp.Choices[0].Message
	return *finalMsg.Content, nil
}

func toPtr[T any](v T) *T {
	return &v
}
