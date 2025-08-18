export default `query GetTask($taskId: String!, $execution: Int) {
  task(taskId: $taskId, execution: $execution) {
    id
    displayName
    displayStatus
    execution
    patchNumber
    buildVariant
    projectIdentifier
    versionMetadata {
      id
      isPatch
      message
      projectIdentifier
      projectMetadata {
        id
      }
      revision
    }
    details {
      description
      failingCommand
      status
    }
  }
}
`;
