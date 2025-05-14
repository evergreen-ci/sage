package evergreen

import (
	"encoding/json"
	"evergreen-ai-service/config"
	"fmt"
	"io/ioutil"
	"net/http"
)

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
	// Simulated task data
	//return map[string]interface{}{
	//	"task_id":        result["task_id"],
	//	"execution":      result["execution"],
	//	"status":         result["status"],
	//	"display_status": result["display_status"],
	//	"activated_by":   result["activated_by"],
	//	"distro_id":      result["distro_id"],
	//	"build_variant":  result["build_variant"],
	//	"display_name":   result["display_name"],
	//}, nil
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
