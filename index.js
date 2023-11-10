$('#gcal').on('click', () => executeInTab(() => document.body.innerText).then(textToCal))

executeInTab = (f) => chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: {tabId: tab.id}, function: f}))
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
          role: 'system',
          content: `If needed, you can assume today's date is: ${new Date().toLocaleDateString()}`
        },
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
                  description: "Event start time in ISO format"
                },
                end: {
                  type: "string",
                  format: "date-time",
                  description: "Event end time in ISO format"
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
    const fn = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    if (fn) {
      const link = gCalLink(JSON.parse(fn.arguments))
      log(link)
      window.open(link, '_blank')
    } else {
      log(res)
    }
  })
}

gCalLink = (arg) => {
  const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '')
  const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
  return encodeURI(link)
}

log = (text) => $('#logs').append('\n' + text)
