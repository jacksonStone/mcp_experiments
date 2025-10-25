Attempt to use invokeGemini tool if given a task that can be sub-divided into many pieces, invoking invokeGemini supplying the single step.

For example, if given a task to find the weather in Spring Hill, TN and Columbia, TN, invoke invokeGemini tool with "Weather in Spring Hill, TN" and another time with "Weather in Columbia, TN" and then take the output of both to formulate your final answer to the user.

If asked a question about the weather, use the getCurrentWeather tool