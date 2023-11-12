let settings = {}

const selectionOrText = () => {
  const selected = window.getSelection().toString()
  return selected?.length < 10 ? document.body.innerText : selected
}

const tools = [
  {
    id: 'chat',
    title: 'Chat with Page',
    detail: 'Opens ChatGPT (with prompt in clipboard) to chat with page',
    runInTab: selectionOrText,
    fn: (tab, page) => {
      const q = [
        `I am copying the text from ${tab.url} below:`,
        page,
        `I have some questions about above text. Please analyze it and answer the following:`,
        window.prompt('Ask ChatGPT about this page', 'Summarize this page')
      ].join('\n\n')
      chrome.tabs.update(tab.id, {'active': true}, // rm when this bug is fixed https://stackoverflow.com/questions/69425289/
        () => copyAndOpen(q, 'https://chat.openai.com/'))
    }
  },
  {
    id: 'gcal',
    title: 'To Google calendar',
    detail: 'Create Google calendar invite from contents of this page',
    runInTab: selectionOrText,
    fn: (tab, text) => askChatGpt(
      `I saved the text from a webpage (url=${tab.url}). I will paste it below. Can you create a function call out of it?\n\n` + text,
      {
        f: (arg) => {
          const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '').replaceAll('Z', '')
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
    id: 'outlook',
    title: 'To Outlook rules',
    detail: 'Create Outlook filter with selected emails',
    urlFilter: 'outlook.live.com',
    runInTab: () => Array.from(document.querySelectorAll('div[aria-selected="true"] span[title*="@"]')).map(el => el.title),
    fn: (tab, emails) => {
      if (emails && emails.length > 0) {
        copyAndOpen(emails.join('; '), 'https://outlook.live.com/mail/0/options/mail/rules')
      } else {
        log('No email selected')
      }
    }
  },
  {
    id: 'rule_dedupe',
    title: 'Dedupe Outlook rules',
    detail: 'Dedupe Outlook FROM rules',
    urlFilter: 'mail/rules',
    runInTab: () => {
      const unique = (arr) => [...new Set(arr)]
      //const clipboard = await navigator.clipboard.readText()
      return unique(Array.from(document.querySelectorAll('span'))
        .map(el => el.innerText?.replace('\n', '').replace(/[^\x00-\x7F]/g, "").trim())
        .filter(text => text.includes('@') && !text.includes(' ')))
        .sort()
        .join('; ')
    },
    fn: (tab, emails) => copyAndOpen(emails)
  }
]

$(document).ready(async () => {
  $('input').change(() => $('#save').prop('disabled', false).text('Save'))

  $('#save').click(() => {
    settings = {}
    $('input').toArray().forEach((el) => {settings[el.id] = el.value})
    chrome.storage.sync.set(settings).then(() => $('#save').prop('disabled', true).text(`Saved ${settings}`))
  })

  settings = await chrome.storage.sync.get(null)
  Object.entries(settings).forEach(([key, value]) => $('#' + key).val(value))

  const tab = await chrome.tabs.query({active: true, lastFocusedWindow: true}).then(([tab]) => tab)
  if (tab) {
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
  }

  if (new URL(document.location).searchParams.get('mode') === 'options' || !settings.openai_api_key) {
    $('#main').hide()
    $('#options').show()
  } else {
    $('#main').show()
    $('#options').hide()
  }
})

const askChatGpt = (
  prompt,
  fn,
  systemMsg = `If needed, you can assume today's date is: ${new Date().toLocaleDateString()}`,
  model = 'gpt-3.5-turbo'
) => {
  log(`Asking ${model} ...`)
  const data = {
    model: model,
    messages: [{role: 'system', content: systemMsg}, {role: 'user', content: prompt}]
  }
  if (fn) {
    data.tools = [{type: 'function', function: fn.schema}]
  }
  return $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.openai_api_key},
    data: JSON.stringify(data)
  }).then(res => {
    const {arguments} = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    if (fn && arguments) {
      return fn.f(JSON.parse(arguments))
    } else {
      return res?.choices?.[0]?.message?.content
    }
  })
}

const copyAndOpen = (text, url) => navigator.clipboard.writeText(text).then(() => {if (url) window.open(url)})

const log = (text) => $('#logs').text(text)
