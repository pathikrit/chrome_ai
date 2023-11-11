const tools = [
  {
    id: 'gcal',
    title: 'To Google calendar',
    detail: 'Create Google calendar invite from contents of this page',
    runInTab: () => document.body.innerText,
    fn: (tab, text) => askChatGpt(
      `I saved the text from a webpage (url=${tab.url}). I will paste it below. Can you create a function call out of it?\n\n` + text,
      {
        f: (arg) => {
          const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '')
          const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
          window.open(encodeURI(link))
        },
        schema: {
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
    )
  },
  {
    id: 'chat',
    title: 'Chat with Page',
    detail: 'Ask ChatGPT about this page',
    runInTab: () => document.body.innerText,
    fn: (tab, text) => {
      const q = prompt('Ask ChatGPT about this page', 'Summarize this page')
    }
  },
  {
    id: 'outlook',
    title: 'To Outlook rules',
    detail: 'Create Outlook filter with selected emails',
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
  const tab = await chrome.tabs.query({active: true, lastFocusedWindow: true}).then(([tab]) => tab)
  if (!tab) return
  tools.forEach(tool => {
    if (tab.url.includes(tool.urlFilter ?? '')) {
      const click = () => chrome.scripting
        .executeScript({target: {tabId: tab.id}, function: tool.runInTab})
        .then(([{result}]) => tool.fn(tab, result))
      $('<button>', {id: tool.id, title: tool.detail, 'data-tooltip': tool.detail})
        .text(tool.title)
        .click(click)
        .appendTo($('#tools'))
    }
  })
})

const log = (text) => $('#logs').append(text + '\n')
