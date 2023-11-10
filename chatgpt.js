OPENAI_API_KEY = 'XX-XXXXXXXXXXXXXXXXXXXXXXXXXX'

const chatGptFunctionCall = (
  prompt,
  functionSchema,
  fn,
  noFn,
  systemMsg = `If needed, you can assume today's date is: ${new Date().toLocaleDateString()}`,
  model = 'gpt-3.5-turbo'
) => $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY},
    data: JSON.stringify({
      model: model,
      messages: [{role: 'system', content: systemMsg}, {role: 'user', content: prompt}],
      tools: [{type: 'function', function: functionSchema}]
    })
  }).then(res => {
    const { arguments } = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    return arguments ? fn(JSON.parse(arguments)) : noFn(res)
  })
  .catch(noFn)
