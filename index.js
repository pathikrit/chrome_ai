let settings = {}

const selectionOrText = () => {
  const selected = window.getSelection().toString()
  return selected?.length > 10 ? selected : document.body.innerText
}

const tools = [
  {
    id: 'chat',
    title: 'Chat with Page',
    detail: 'Opens ChatGPT (with prompt in clipboard) to chat with page',
    runInTab: selectionOrText,
    fn: (tab, page) => {
      const query = window.prompt('Ask ChatGPT about this page', 'Summarize this page')
      if (!query) return
      const prompt = [
        `I am copying the text from ${tab.url} below:`,
        page.slice(0, 10000),
        `I have some questions about above text. Please analyze it and answer the following:`,
        query
      ].join('\n\n')
      log(`Opening ChatGPT with ${page.length} chars page ...`)
      copy(prompt).then(() => openUrl('https://chat.openai.com/'))
    }
  },
  {
    id: 'gcal',
    title: 'To Google calendar',
    detail: 'Create Google calendar invite from contents of this page',
    runInTab: selectionOrText,
    fn: (tab, text) => askChatGpt(
      // Take first n chars of text (see https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)
      `I saved the text from a webpage (url=${tab.url}). I will paste it below. Can you create a function call out of it?\n\n` + text.slice(0, 10000),
      {
        f: (arg) => {
          const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '').replaceAll('Z', '')
          const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
          openUrl(encodeURI(link))
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
        copy(emails.join('; ')).then(() => openUrl('https://outlook.live.com/mail/0/options/mail/rules'))
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
      //const clipboard = await navigator.clipboard.readText()
      return Array.from(document.querySelectorAll('span'))
        .map(el => el.innerText?.trim())
        .filter(text => text.includes('@') && !text.includes('\n'))
    },
    fn: (tab, emails) => {
      const before = emails.length
      emails = [...new Set(emails)]
      const after = emails.length
      log(before === after ? `No duplicates found in ${before} emails` : `Deduped ${before} email addresses to ${after} emails ... `)
      copy(emails.sort().join('; '))
    }
  },
  {
    id: 'ril',
    title: `Bulk read links`,
    detail: `Open links in new tabs and mark them as read`,
    urlFilter: 'getpocket.com/saves',
    runInTab: () => {
      const n = 10
      const links = Array.from(document.querySelectorAll('a[data-cy="content-block"]')).slice(0, n).map(el => el.href)
      Array.from(document.querySelectorAll('button[data-cy="Archive"]')).slice(0, n).forEach(el => el.click())
      return links
    },
    fn: (tab, links) => {
      log(links.join('\n'))
      links.forEach(link => openUrl(link))
    }
  },
]

$(document).ready(async () => {
  $('input').change(() => $('#save').prop('disabled', false).text('Save'))

  $('#save').click(() => {
    settings = {}
    $('input').toArray().forEach((el) => {settings[el.id] = el.value})
    chrome.storage.sync.set(settings).then(() => $('#save').prop('disabled', true).text(`Saved`))
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
          .toggleClass('outline', tool.urlFilter == null)
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
    //fn.f = (args) => { try { return fn.f(args)} catch (e) { log(e) }}
    data.tools = [{type: 'function', function: fn.schema}]
  }
  return $.post({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.openai_api_key},
    data: JSON.stringify(data)
  }).then(res => {
    log(`Parsing response from ${model} ...`)
    try {
      const {arguments} = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
      if (fn && arguments) {
        return fn.f(JSON.parse(arguments))
      } else {
        return res?.choices?.[0]?.message?.content
      }
    } catch (e) {
      log(e)
      throw e
    }
  })
}

const copy = (text) => navigator.clipboard.writeText(text)

const openUrl = (url, tab) => { tab ? chrome.tabs.update(tab.id, {url}) : chrome.tabs.create({url}) }

const log = (text) => $('#logs').text(text)
