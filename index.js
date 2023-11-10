$('#gcal').on('click', () => {
  //tabToText().then(log)
  textToCal("Let's meet tomorrow at Bernie's at 2pm")
});

tabToText = () => chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: {tabId: tab.id}, function: () => document.body.innerText}))
    .then(([{ result }]) => result)

OPENAI_API_KEY=

textToCal = (text) => {
  log('Calling ChatGPT ...')
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
                location: {
                  type: "string",
                  description: "Event location"
                },
                details: {
                  type: "string",
                  description: "Event description (short)"
                }
              },
              required: ["title", "start", "end"],
            }
          }
        }
      ]
    })
  }).then(res => {
    log('Received msg', res)
    const fn = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    if (fn) {
      const link = gCalLink(JSON.parse(fn.arguments))
      log(link)
    } else {
      log(res)
    }
  })
}

// https://calendar.google.com/calendar/render?action=TEMPLATE&text=Meeting%20at%20Bernie's&dates=20211103T140000Z/20211103T150000Z&location=Bernie's&details=

gCalLink = (arg) => {
  const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '')
  const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
  return encodeURI(link)
}

log = (text) => {
  console.log(text)
  $('#logs').append('\n' + text)
}
