package evergreen

func HandleGetTask(taskId string, execution int) (map[string]interface{}, error) {

	// Simulated task data
	return map[string]interface{}{
		"task_id":        taskId,
		"execution":      execution,
		"status":         "success",
		"display_status": "success",
		"activated_by":   "mohamed.khelif",
		"distro_id":      "ubuntu2204-large",
		"build_variant":  "spruce",
		"display_name":   "compile",
	}, nil
}
