package orchestrator

import (
	"evergreen-ai-service/evergreen"
	"fmt"
)

// ToolHandler defines a function that handles a tool request
type ToolHandler func(args map[string]interface{}) (map[string]interface{}, error)

// ToolCall represents a model tool invocation
type ToolCall struct {
	Tool string                 `json:"tool"`
	Args map[string]interface{} `json:"args"`
}

// ToolResult represents the tool output passed back to the model
type ToolResult struct {
	Tool    string                 `json:"tool"`
	Results map[string]interface{} `json:"results"`
}

// toolbox maps tool names to their respective handlers
// This is where you can add new tools and their handlers
var toolbox = map[string]ToolHandler{
	"get_task": evergreen.HandleGetTask,
}

func validateTool(toolName string) (ToolHandler, error) {
	handler, ok := toolbox[toolName]
	if !ok {
		return nil, fmt.Errorf("unsupported tool: %s", toolName)
	}
	return handler, nil
}
