package orchestrator

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"evergreen-ai-service/evergreen"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
)

type ToolHandler func(args map[string]interface{}) (map[string]interface{}, error)

type ToolResult struct {
	Tool    string                 `json:"tool"`
	Results map[string]interface{} `json:"results"`
}

var toolbox = make(map[string]ToolHandler)
var toolDefinitions []azopenai.ChatCompletionsToolDefinitionClassification

type toolParams struct {
	Type                 string                       `json:"type"`
	Properties           map[string]map[string]string `json:"properties"`
	Required             []string                     `json:"required"`
	AdditionalProperties bool                         `json:"additionalProperties"`
}

func init() {
	initToolbox()
}

func initToolbox() {
	// Register handler
	toolbox["get_task"] = getTaskHandler
	toolbox["end_orchestration"] = endOrchestrationHandler

	// Register tool
	getTaskTool := getTaskHandlerToolDefinition()
	endOrchestrationTool := getEndOrchestrationToolDefinition()

	// Define tool
	toolDefinitions = []azopenai.ChatCompletionsToolDefinitionClassification{
		getTaskTool,
		endOrchestrationTool,
	}
}

func validateTool(toolName string) (ToolHandler, error) {
	handler, ok := toolbox[toolName]
	if !ok {
		return nil, fmt.Errorf("unsupported tool: %s", toolName)
	}
	return handler, nil
}

// isEndOrchestrationTool checks if the tool is "end_orchestration"
// and returns true if it is, false otherwise. This is used to determine if we should stop the orchestration and prepare to send a response to the user.
func isEndOrchestrationTool(toolName string) bool {
	return toolName == "end_orchestration"
}
func getEndOrchestrationToolDefinition() *azopenai.ChatCompletionsFunctionToolDefinition {
	// Build schema struct
	params := toolParams{
		Type:                 "object",
		Properties:           map[string]map[string]string{},
		Required:             []string{},
		AdditionalProperties: false,
	}

	// Marshal schema
	paramBytes, err := json.Marshal(params)
	if err != nil {
		panic("failed to marshal get_task params: " + err.Error())
	}
	return &azopenai.ChatCompletionsFunctionToolDefinition{
		Function: &azopenai.ChatCompletionsFunctionToolDefinitionFunction{
			Name:       to.Ptr("end_orchestration"),
			Strict:     to.Ptr(true),
			Parameters: paramBytes,
		},
	}
}

// getTaskHandlerToolDefinition returns the tool definition for the get_task function
func getTaskHandlerToolDefinition() *azopenai.ChatCompletionsFunctionToolDefinition {
	// Build schema struct
	params := toolParams{
		Type: "object",
		Properties: map[string]map[string]string{
			"task_id":   {"type": "string"},
			"execution": {"type": "string"},
		},
		Required:             []string{"task_id", "execution"},
		AdditionalProperties: false,
	}

	// Marshal schema
	paramBytes, err := json.Marshal(params)
	if err != nil {
		panic("failed to marshal get_task params: " + err.Error())
	}
	return &azopenai.ChatCompletionsFunctionToolDefinition{
		Function: &azopenai.ChatCompletionsFunctionToolDefinitionFunction{
			Name:       to.Ptr("get_task"),
			Strict:     to.Ptr(true),
			Parameters: paramBytes,
		},
	}
}
func getTaskHandler(args map[string]interface{}) (map[string]interface{}, error) {
	taskID, ok1 := args["task_id"].(string)
	execution, ok2 := args["execution"].(string)
	if !ok1 || !ok2 {
		fmt.Println(args)
		return nil, errors.New("missing or invalid arguments")
	}

	// Convert execution to int
	executionInt, err := strconv.Atoi(execution)
	if err != nil {
		return nil, fmt.Errorf("invalid execution value: %s", execution)
	}

	task, err := evergreen.HandleGetTask(taskID, executionInt)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"task": task}, nil
}

func endOrchestrationHandler(args map[string]interface{}) (map[string]interface{}, error) {
	// Implement the endOrchestration logic here
	return nil, nil
}
