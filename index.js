let config = undefined

const tools = [
  {
    id: 'gcal',
    title: 'To Google calendar',
    runInTab: () => document.body.innerText,
    fn: (tab, text) => textToCal(tab.url, text)
  },
  {
    id: 'outlook',
    title: 'To Outlook rules',
    urlFilter: 'outlook.live.com',
    runInTab: () => Array.from(document.querySelectorAll('div[aria-selected="true"] span[title*="@"]')).map(el => el.title),
    fn: (tab, emails) => {
      if (emails && emails.length > 0) {
        const text = emails.join('; ')
        log(text)
        return navigator.clipboard.writeText(text).then(() => window.open('https://outlook.live.com/mail/0/options/mail/rules'))
      } else {
        log('No email selected')
      }
    }
  }
]

$(document).ready(async () => {
  config = await fetch('config.json').then(res => res.json())
  const tab = await currentTab()
  if (tab) {
    for (const tool of tools) {
      if (tab.url.includes(tool.urlFilter ?? '')) {
        $(document.body).prepend(`<button id="${tool.id}">${tool.title}</button><br/><br/>`)
        $('#' + tool.id).on('click', () => chrome.scripting.executeScript({target: {tabId: tab.id}, function: tool.runInTab}).then(([{ result }]) => tool.fn(tab, result)))
      }
    }
  }
})

currentTab = () => chrome.tabs.query({active: true, lastFocusedWindow: true}).then(([tab]) => tab)

textToCal = (url, text) => {
  log('Calling ChatGPT ...')
  return $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.OPENAI_API_KEY
    },
    data: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {role: 'system', content: `If needed, you can assume today's date is: ${new Date().toLocaleDateString()}`},
        {role: 'user', content: `I saved the text from a webpage (url=${url}). I will paste it below. Can you create a function call out of it?` + text
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
                title: {type: "string", description: "Event title"},
                start: {type: "string", format: "date-time", description: "Event start time in ISO format"},
                end: {type: "string", format: "date-time", description: "Event end time in ISO format"},
                location: {type: "string", description: "Event location"},
                details: {type: "string", description: "Event description (short)"}
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
      log(JSON.stringify(res))
    }
  })
}

gCalLink = (arg) => {
  const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '')
  const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
  return encodeURI(link)
}

log = (text) => $('#logs').append('\n' + text)
