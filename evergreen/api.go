package evergreen

import (
	"fmt"
)

func HandleGetTask(args map[string]interface{}) (map[string]interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'task_id'")
	}
	execID, ok := args["execution"]
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'execution'")
	}

	// Simulated task data
	return map[string]interface{}{
		"task_id":        taskID,
		"execution":      execID,
		"status":         "success",
		"display_status": "success",
		"activated_by":   "mohamed.khelif",
		"distro_id":      "ubuntu2204-large",
		"build_variant":  "spruce",
		"display_name":   "compile",
	}, nil
}
