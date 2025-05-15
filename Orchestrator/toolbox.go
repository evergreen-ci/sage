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
	Type                 string                            `json:"type"`
	Properties           map[string]map[string]interface{} `json:"properties"`
	Required             []string                          `json:"required"`
	AdditionalProperties bool                              `json:"additionalProperties"`
}

func init() {
	initToolbox()
}

func initToolbox() {
	// Register handler
	toolbox["get_task"] = getTaskHandler
	toolbox["get_task_history"] = getTaskHistoryHandler
	toolbox["get_task_logs"] = getTaskLogsHandler
	toolbox["end_orchestration"] = endOrchestrationHandler

	// Register tool
	getTaskTool := getTaskHandlerToolDefinition()
	getTaskHistoryTool := getTaskHistoryHandlerToolDefinition()
	getTaskLogsTool := getTaskLogsHandlerToolDefinition()
	endOrchestrationTool := getEndOrchestrationToolDefinition()

	// Define tool
	toolDefinitions = []azopenai.ChatCompletionsToolDefinitionClassification{
		getTaskTool,
		getTaskHistoryTool,
		getTaskLogsTool,
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
		Properties:           map[string]map[string]interface{}{},
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
		Properties: map[string]map[string]interface{}{
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

// getTaskHistoryHandlerToolDefinition returns the tool definition for the get_task_history function
func getTaskHistoryHandlerToolDefinition() *azopenai.ChatCompletionsFunctionToolDefinition {
	// Build schema struct
	params := toolParams{
		Type: "object",
		Properties: map[string]map[string]interface{}{
			"task_name":          {"type": "string"},
			"build_variant":      {"type": "string"},
			"task_id":            {"type": "string"},
			"direction":          {"type": "string", "enum": []interface{}{"BEFORE", "AFTER"}},
			"project_identifier": {"type": "string"},
		},
		Required:             []string{"project_identifier", "task_name", "build_variant", "task_id", "direction"},
		AdditionalProperties: false,
	}

	// Marshal schema
	paramBytes, err := json.Marshal(params)
	if err != nil {
		panic("failed to marshal get_task_history params: " + err.Error())
	}
	return &azopenai.ChatCompletionsFunctionToolDefinition{
		Function: &azopenai.ChatCompletionsFunctionToolDefinitionFunction{
			Name:       to.Ptr("get_task_history"),
			Strict:     to.Ptr(true),
			Parameters: paramBytes,
		},
	}
}

// getTaskLogsHandlerToolDefinition returns the tool definition for the get_task_logs function
func getTaskLogsHandlerToolDefinition() *azopenai.ChatCompletionsFunctionToolDefinition {
	// Build schema struct
	params := toolParams{
		Type: "object",
		Properties: map[string]map[string]interface{}{
			"task_id": {"type": "string"},
		},
		Required:             []string{"task_id"},
		AdditionalProperties: false,
	}

	// Marshal schema
	paramBytes, err := json.Marshal(params)
	if err != nil {
		panic("failed to marshal get_task_logs params: " + err.Error())
	}
	return &azopenai.ChatCompletionsFunctionToolDefinition{
		Function: &azopenai.ChatCompletionsFunctionToolDefinitionFunction{
			Name:       to.Ptr("get_task_logs"),
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

func getTaskHistoryHandler(args map[string]interface{}) (map[string]interface{}, error) {
	taskName, ok := args["task_name"].(string)
	if !ok {
		fmt.Println(args)
		return nil, errors.New("missing task_name argument")
	}
	buildVariant, ok := args["build_variant"].(string)
	if !ok {
		fmt.Println(args)
		return nil, errors.New("missing build_variant argument")
	}
	taskID, ok := args["task_id"].(string)
	if !ok {
		fmt.Println(args)
		fmt.Println(args["task_id"])
		return nil, errors.New("missing task_id argument")
	}
	direction, ok := args["direction"].(string)
	if !ok {
		fmt.Println(args)
		return nil, errors.New("missing direction argument")
	}
	projectIdentifier, ok := args["project_identifier"].(string)
	if !ok {
		fmt.Println(args)
		return nil, errors.New("missing project_identifier argument")
	}

	task, err := evergreen.HandleGetTaskHistory(projectIdentifier, taskName, buildVariant, taskID, direction)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"task_history": task}, nil
}

func getTaskLogsHandler(args map[string]interface{}) (map[string]interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		fmt.Println(args)
		return nil, errors.New("missing or invalid arguments")
	}

	task, err := evergreen.HandleGetTaskLogs(taskID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"task_logs": task}, nil
}

func endOrchestrationHandler(args map[string]interface{}) (map[string]interface{}, error) {
	// Implement the endOrchestration logic here
	return nil, nil
}
