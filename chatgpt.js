OPENAI_API_KEY = 'XX-XXXXXXXXXXXXXXXXXXXXXXXXXX'

const chatGptFunctionCall = (
  prompt,
  fn,
  systemMsg = `If needed, you can assume today's date is: ${new Date().toLocaleDateString()}`,
  model = 'gpt-3.5-turbo'
) => {
  const data = {
    model: model,
    messages: [{role: 'system', content: systemMsg}, {role: 'user', content: prompt}]
  }
  if (fn) {
    data.tools = [{type: 'function', function: fn.schema}]
  }
  return $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY},
    data: JSON.stringify(data)
  }).then(res => {
    const { arguments } = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    if (fn && arguments) {
      return fn.f(JSON.parse(arguments))
    } else {
      return res?.choices?.[0]?.message?.content
    }
  })
}
