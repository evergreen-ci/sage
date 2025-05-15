package evergreen

import (
	"context"
	"encoding/json"
	"evergreen-ai-service/config"
	"evergreen-ai-service/openaiservice"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
)

const logPrompt = "The following is a section of a log file. Please analyze it and provide a brief summary of key events, errors, and notable patterns. Focus on important information and anomalies:\n\n%s"
const logPromptWithContext = "The following is a section of a log file. Previous sections analysis:\n%s\n\nPlease analyze this new section and provide a brief summary of key events, errors, and notable patterns. Focus on important information, anomalies, and connections to previously observed patterns:\n\n%s"

var numPrevSections = 5

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

func HandleGetTaskHistory(taskName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/task_history/%s?format=json&before=true", config.Config.EvergreenURL, taskName)
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
	prompt := fmt.Sprintf(logPrompt, section.Content)

	chatMessages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent("You are a log analysis assistant. Analyze the log sections and provide concise, useful summaries focusing on errors, warnings, and other notable patterns."),
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
	prompt := fmt.Sprintf(logPromptWithContext, prevContext, section.Content)

	chatMessages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent("You are a log analysis assistant. Analyze the log sections and provide concise, useful summaries focusing on errors, warnings, and other notable patterns. When possible, connect patterns and events to those seen in previous sections."),
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
