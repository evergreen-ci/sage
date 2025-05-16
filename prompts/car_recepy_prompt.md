Engineers use the scientific method to investigate Build Failures:

  - First, generate an hypothesis of the failure
  - Search for evidence that confirm or deny the hypothesis
  - If the hypothesis is false, try again

The following are strategies used to generate hypothesis

* Strategy 1

  - Try to understand the topology of the cluster, defining the number of shards, routers, and the number of nodes per replica set
  - Check the versions of each node
  - Determine the nature or category of the error, i.e., whether the reported error is an inconsistency, a timeout or a hang
  - Generate an hypothesis by inspecting the logs considering all the points previously stated
  - To confirm or deny the hypothesis, analyze the logs to determine the secuence of events that lead to the failure

* Strategy 2

  - Analyze the metadata first, which includes how often the failure is happening, when it started, how it manifests, which variants, suites, platforms and tests are failing, and, in the build failure information, the error that occurred, considering also the latest changes relevant to that information
  - Then, with a first hypothesis in mind, investigate the logs. Try to trace commands that originated from the test, passed through the router, and reached the shard, so we can confirm or discard the hypothesis
  - Finally if the initial hypothesis is false, inspect the logs to form another hypothesis

* Strategy 3

  - First, construct a context of the state of the cluster before the failure by looking for common traces of operations executed by the test, like the ones that start with "About to run the command" and "Slow query"
  - Look at the oplog of the failed node, if it was a data bearing node, to have a sense of the operations that happened prior to the failure
  - Look at the final state of the local and catalog by inspecting the data files and the sharded catalog by inspecting the config server data files
  - By looking at the logs, try to determine the in-memory state of the cluster
  - With all that information, generate a hypothesis of what could be going wrong
  - One option could be to generate a test that can reproduce the state and run it locally, or run the test multiple times with a similar configuration until the failure happens again, and then use print statements to try to understand the state of the cluster before the failure

* Strategy 4

  - Read and understand the test that failed
  - Check the suite configuration to understand which operations might be running in the background
  - Filter the logs based on the parameters above
  - If an error was detected, check the code to see where that error was generated
  - Investigate the data files to check the state of the node before the failure, specifically the oplog

* Strategy 5

  - First determine if the failure is easy to determine by looking at the logs. If it was a crash, then look at the stack trace and try to reproduce the state
  - If it is not easy, dig deeper into the logs, try to determine state transitions, and look for similar ocurrences
  - If an hypothesis have not yet been determined, then start at the failure and work backwards to determine what the state of the server was
  - Look for topology changes, such as replica set transitions, or any suspicious log
  - Form an hypothesis and try to reproduce it locally with a test

* Strategy 6

  - Compare the failed task logs with a succesfull one
  - Construct the state of the cluster until the point of divergence of the operations
  - Try to determine whether the differences given the state of the cluster could have led to the failure by investigating the source code
  - Try to produce a reproducible