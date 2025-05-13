package orchestrator

import (
	"fmt"
	"strings"
)

func validateIfMessageHasToolCall(message string) (bool, error) {
	// Check if the message contains a tool call
	if message == "" {
		return false, fmt.Errorf("message is empty")
	}
	if strings.Contains(message, "tool") {
		return true, nil
	}
	return false, nil
}

// Strips the ```json ``` from the tool call JSON
// and returns the cleaned JSON string
func cleanToolCallJSONStrings(message string) (string, error) {
	// Check if the message contains a tool call
	if message == "" {
		return "", fmt.Errorf("message is empty")
	}
	if strings.Contains(message, "```json") {
		message = strings.ReplaceAll(message, "```json", "")
		message = strings.ReplaceAll(message, "```", "")
	}
	return message, nil
}
