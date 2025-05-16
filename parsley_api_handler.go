package main

import (
	"encoding/json"
	orchestrator "evergreen-ai-service/Orchestrator"
	"evergreen-ai-service/config"
	"fmt"
	"net/http"
	"os"

	"github.com/evergreen-ci/utility"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/Azure/azure-sdk-for-go/sdk/ai/azopenai"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

var systemMessage string

func InitParsleySystemMessage() error {
	promptBuffer, err := os.ReadFile("prompts/parsley_system_prompt.md")
	if err != nil {
		config.Logger.Error("Failed to read system message file", zap.Error(err))
		return err
	}
	systemMessage = string(promptBuffer)
	return nil
}

func ParsleyGinHandler(c *gin.Context) {
	var req struct {
		Message   string `json:"message"`
		Session   string `json:"session"`
		TaskID    string `json:"task_id"`
		Execution *int   `json:"execution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	message := req.Message
	if req.TaskID == "" || req.Execution == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task ID and execution are required"})
		return
	}
	if req.Session != "" {
		id, err := primitive.ObjectIDFromHex(req.Session)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
			return
		}
		var sessionResp Session
		result := mongoClient.Database("parsley-ai-agent-skunkworks").Collection("sessions").FindOne(c, bson.M{"_id": id})
		if err := result.Decode(&sessionResp); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		if sessionResp.PreviousConversation != "" {
			message = fmt.Sprintf("here is the previous conversation context: %s", sessionResp.PreviousConversation) + "and here is the new message prompt: " + message
		}
	}
	messages := []azopenai.ChatRequestMessageClassification{
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(systemMessage),
		},
		&azopenai.ChatRequestSystemMessage{
			Content: azopenai.NewChatRequestSystemMessageContent(fmt.Sprintf("Task ID: %s, Execution: %d"+req.TaskID, req.Execution)),
		},
		&azopenai.ChatRequestUserMessage{
			Content: azopenai.NewChatRequestUserMessageContent(message),
		},
	}
	resp, err := orchestrator.RunOrchestrationWithNativeTools(c, messages)

	if err != nil {
		config.Logger.Error("Failed to get response from OpenAI", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response from OpenAI"})
		return
	}
	session := req.Session
	if session == "" {
		session = primitive.NewObjectID().Hex()
	}
	id, err := primitive.ObjectIDFromHex(session)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
	}
	sessionDoc := Session{
		Id:                   id,
		PreviousConversation: resp,
	}
	query := bson.M{
		"_id": id,
	}
	update := bson.M{
		"$set": sessionDoc,
	}
	_, err = mongoClient.Database("parsley-ai-agent-skunkworks").Collection("sessions").UpdateOne(c, query, update, &options.UpdateOptions{Upsert: utility.TruePtr()})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert session into database"})
		return
	}
	var parsedResp map[string]interface{}
	err = json.Unmarshal([]byte(resp), &parsedResp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response into JSON"})
		return
	}
	parsedResp["session"] = session
	// HACK: sometimes the IA returns {args: {links:[...], response: "..."}} instead of {links:[...], response: "..."}
	var r = parsedResp["args"]
	if r == nil {
		r = parsedResp
	}
	c.JSON(http.StatusOK, r)
}

type Session struct {
	Id                   primitive.ObjectID `bson:"_id" json:"id"`
	PreviousConversation string             `json:"previous_conversation" bson:"previous_conversation"`
}
