$('#gcal').on('click', () => {
  //tabToText().then(log)
  askChatGPT("Let's meet tomorrow at Bernie's at 2pm").then(res => log(JSON.stringify(res)))
});

tabToText = () => chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: {tabId: tab.id}, function: () => document.body.innerText}))
    .then(([{ result }]) => result)

OPENAI_API_KEY=

askChatGPT = (text) => {
  return $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_API_KEY
    },
    data: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'I saved the text from a webpage. I will paste it below. Can you create a function call out of it?\n\n' + text
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_calendar_invite',
            description: 'Creates a calendar invite with given title, start date and time, end date and time, location and description',
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Event title"
                },
                start: {
                  type: "string",
                  format: "date-time",
                  description: "Event start time"
                },
                end: {
                  type: "string",
                  format: "date-time",
                  description: "Event end time"
                },
                details: {
                  type: "string",
                  description: "Event description"
                }
              },
              required: ["title", "start"],
            }
          }
        }
      ]
    })
  })
}

log = (text) => {
  console.log(text)
  $('#logs').append('\n' + text)
}
