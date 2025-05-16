package evergreen

import (
	"context"
	"encoding/json"
	"evergreen-ai-service/config"
	"evergreen-ai-service/openaiservice"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strings"

	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"

	"go.uber.org/zap"
)

var analyzeLogInitialSystemMessage string
var analyzeLogGeneralSystemMessage string
var analyzeLogInitialPrompt string
var analyzeLogPromptWithContext string
var recepySystemMessage string
var numPrevSections = 5

func InitAnalyzeLogSystemMessages() error {
	promptBuffer, err := os.ReadFile("prompts/analyze_log_initial_system_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read analyze log initial system message file", zap.Error(err))
		return err
	}
	analyzeLogInitialSystemMessage = string(promptBuffer)
	promptBuffer2, err := os.ReadFile("prompts/analyze_log_general_system_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read analyze log general system message file", zap.Error(err))
		return err
	}
	analyzeLogGeneralSystemMessage = string(promptBuffer2)
	promptBuffer3, err := os.ReadFile("prompts/analyze_log_initial_user_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read analyze log initial user message file", zap.Error(err))
		return err
	}
	analyzeLogInitialPrompt = string(promptBuffer3)
	promptBuffer4, err := os.ReadFile("prompts/analyze_log_general_user_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read analyze log general user message file", zap.Error(err))
		return err
	}
	analyzeLogPromptWithContext = string(promptBuffer4)
	return nil

}

func InitRecepySystemMessage() error {
	promptBuffer, err := os.ReadFile("prompts/car_recepy_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read recepy system message file", zap.Error(err))
		return err
	}
	recepySystemMessage = string(promptBuffer)
	return nil

}

func HandleGetTask(taskId string, execution int) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/tasks/%s", config.Config.EvergreenAPIURL, taskId)
	if execution > 0 {
		url += fmt.Sprintf("?execution=%d", execution)
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Api-User", config.Config.EvergreenAPIUser)
	req.Header.Set("Api-Key", config.Config.EvergreenAPIKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func HandleGetTaskHistory(projectIdentifier, taskName, buildVariant, taskID, direction string) (map[string]interface{}, error) {
	url := config.Config.EvergreenURL + "/graphql/query"
	query := `query TaskHistory($options: TaskHistoryOpts!) {
		taskHistory(options: $options) {
			pagination {
				mostRecentTaskOrder
				oldestTaskOrder
			}
			tasks {
				id
				activated
				canRestart
				createTime
				displayStatus
				execution
				order
				revision
				details {
					description
					status
					timedOut
					timeoutType
					type
					oomTracker {
						detected
					}
				}
				versionMetadata {
					id
					author
					message
				}
			}
		}
	}`

	variables := map[string]interface{}{
		"options": map[string]interface{}{
			"projectIdentifier": projectIdentifier,
			"taskName":          taskName,
			"buildVariant":      buildVariant,
			"cursorParams": map[string]interface{}{
				"cursorId":      taskID,
				"direction":     direction,
				"includeCursor": true,
			},
		},
	}

	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonPayload)))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("Api-User", config.Config.EvergreenAPIUser)
	req.Header.Set("Api-Key", config.Config.EvergreenAPIKey)
	req.Header.Set("Content-Type", "application/json")

	// Use HTTP client with timeout
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("non-200 response: %d %s", resp.StatusCode, resp.Status)
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Check if GraphQL returned any errors
	if errs, ok := result["errors"]; ok {
		config.Logger.Warn("GraphQL error returned", zap.Any("errors", errs))
		return result, fmt.Errorf("GraphQL error: %v", errs)
	}

	return result, nil
}

func HandleGetTaskLogs(taskID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/tasks/%s/build/TaskLogs?type=task_log", config.Config.EvergreenAPIURL, taskID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Api-User", config.Config.EvergreenAPIUser)
	req.Header.Set("Api-Key", config.Config.EvergreenAPIKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	sections, err := divideLogIntoSections(string(body), 30000)
	if err != nil {
		return nil, err
	}
	summary, err := processLogsSequentially(sections)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"summary": summary,
	}, nil
}

type LogSection struct {
	ID      int
	Content string
}
type AnalysisResult struct {
	SectionID int
	Summary   string
	Error     error
}

func divideLogIntoSections(input string, sectionSize int) ([]LogSection, error) {
	var sections []LogSection
	lines := strings.Split(input, "\n")
	sectionID := 0
	var currentSection strings.Builder
	lineCount := 0
	for _, line := range lines {
		currentSection.WriteString(line)
		currentSection.WriteString("\n")
		lineCount++

		if lineCount >= sectionSize {
			sections = append(sections, LogSection{ID: sectionID, Content: currentSection.String()})
			sectionID++
			currentSection.Reset()
			lineCount = 0
		}
	}
	if lineCount > 0 {
		sections = append(sections, LogSection{ID: sectionID, Content: currentSection.String()})
	}
	return sections, nil
}

func processLogsSequentially(sections []LogSection) (string, error) {
	prevSummaries := make([]string, numPrevSections)
	prevSummariesIdx := 0
	summariesCount := 0
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var res string
	for i, section := range sections {
		var result AnalysisResult
		if summariesCount == 0 {
			result = analyzeLogSection(ctx, openaiservice.OpenAIClient, section)
		} else {
			var contextBuilder strings.Builder
			for j := 0; j < summariesCount; j++ {
				idx := (prevSummariesIdx - summariesCount + j + numPrevSections) % numPrevSections
				contextBuilder.WriteString(fmt.Sprintf("SECTION %d: %s\n\n", i-summariesCount+j, prevSummaries[idx]))
			}
			result = analyzeLogSectionWithContext(ctx, openaiservice.OpenAIClient, section, contextBuilder.String())
		}

		res += fmt.Sprintf("\n\n ===== SECTION %d ANALYSIS ===== \n\n", section.ID)
		if result.Error != nil {
			res += fmt.Sprintf("Error: %s\n", result.Error.Error())
		} else {
			res += result.Summary
			prevSummaries[prevSummariesIdx] = result.Summary
			prevSummariesIdx = (prevSummariesIdx + 1) % numPrevSections
			if summariesCount < numPrevSections {
				summariesCount++
			}
		}
	}
	return res, nil
}

func analyzeLogSection(ctx context.Context, client *azopenai.Client, section LogSection) AnalysisResult {
	result := AnalysisResult{SectionID: section.ID}
	prompt := fmt.Sprintf(analyzeLogInitialPrompt, section.Content)

	var systemMessage = analyzeLogInitialSystemMessage + "\nTry to generate an hypothesis use a custom strategy or following one used by engineers of the CAR team.\n" + recepySystemMessage
	chatMessages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(systemMessage),
		},
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(prompt),
		},
	}
	resp, err := client.GetChatCompletions(ctx, azopenai.ChatCompletionsOptions{
		Messages:       chatMessages,
		DeploymentName: &openaiservice.ModelDeploymentName,
	}, nil)
	if err != nil {
		result.Error = err
		return result
	}
	if len(resp.Choices) == 0 {
		result.Error = fmt.Errorf("No choices found")
		return result
	}
	result.Summary = *resp.Choices[0].Message.Content
	return result
}

func analyzeLogSectionWithContext(ctx context.Context, client *azopenai.Client, section LogSection, prevContext string) AnalysisResult {
	result := AnalysisResult{SectionID: section.ID}
	prompt := fmt.Sprintf(analyzeLogPromptWithContext, prevContext, section.Content)

	var systemMessage = analyzeLogGeneralSystemMessage + "\nTry to use a custom strategy or one of the following one used by engineers of the CAR team.\n" + recepySystemMessage
	chatMessages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(systemMessage),
		},
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(prompt),
		},
	}
	resp, err := client.GetChatCompletions(ctx, azopenai.ChatCompletionsOptions{
		Messages:       chatMessages,
		DeploymentName: &openaiservice.ModelDeploymentName,
	}, nil)
	if err != nil {
		result.Error = err
		return result
	}
	if len(resp.Choices) == 0 {
		result.Error = fmt.Errorf("No choices found")
		return result
	}
	result.Summary = *resp.Choices[0].Message.Content
	return result
}
