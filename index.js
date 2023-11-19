let settings = {}

const constants = {
  amazon_amount_search_key: '__chrome_ai_amount',
  mode_key: '__chrome_ai_mode'
}

/**
 * Each tool has the following items:
 *  title: (Optional) If missing, we inject this script into page else we show in popup
 *  detail: (Optional) popup hover text; defaults to title
 *  urlContains: (Optional) Only enable if window.location.href contains this string
 *  runInTab: (Optional) Run this in the page; defaults to "get selected text or all document text"
 *  process: (Optional) Process the data returned from above function
 */
const tools = [
  {
    title: 'Chat with page',
    detail: 'Opens ChatGPT (with prompt in clipboard) to chat with page',
    process: (tab, page) => {
      const query = window.prompt('Ask ChatGPT about this page', 'Summarize this page')
      if (!query) return
      const prompt = [
        `I am copying the text from ${tab.url} below:`,
        page.slice(0, 10000),
        `I have some questions about above text. Please analyze it and answer the following:`,
        query
      ].join('\n\n')
      log(`Opening ChatGPT with ${page.length} chars page ...`)
      copy(prompt).then(() => open('https://chat.openai.com/'))
    }
  },
  {
    title: 'To Google Calendar',
    detail: 'Create Google calendar invite from contents of this page',
    process: (tab, text) => askChatGpt(
      // Take first n chars of text (see https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)
      `I saved the text from a webpage (url=${tab.url}). I will paste it below. Can you create a function call out of it?\n\n` + text.slice(0, 10000),
      {
        f: (arg) => {
          const dateFormat = (d) => d.replaceAll('-', '').replaceAll(':', '').replaceAll('Z', '')
          const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${arg.title}&dates=${dateFormat(arg.start)}/${dateFormat(arg.end)}&location=${arg.location ?? ''}&details=${arg.details ?? ''}`
          open(encodeURI(link))
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
    title: 'Extract to a list',
    detail: 'Extract items from this page into a list',
    runInTab: () => {
      const tags = ['h1', 'h2', 'h3', 'h4', /*'h5', 'h6', 'b', 'strong'*/]
      const bigs = tags.flatMap(tag => Array.from(document.querySelectorAll(tag)))
      const bolds = [] //Array.from(document.querySelectorAll('*')).filter(el => getComputedStyle(el).fontWeight > 400)
      const res = bigs.concat(bolds).map(el => el.innerText.trim())
      return [...new Set(res)]
    },
    process: (tab, bolds) => {
      copy(bolds.join('\n'))
        .then(() => {
          log(`Copied ${bolds.length} items`)
          open('https://vscode.dev/')
        })
    }
  },
  {
    title: 'To Outlook rules',
    detail: 'Create Outlook filter with selected emails',
    urlContains: 'outlook.live.com',
    runInTab: () => Array.from(document.querySelectorAll('div[aria-selected="true"] span[title*="@"]')).map(el => el.title),
    process: (tab, emails) => {
      if (emails && emails.length > 0) {
        copy(emails.join('; ')).then(() => open('https://outlook.live.com/mail/0/options/mail/rules'))
      } else {
        log('No email selected')
      }
    }
  },
  {
    title: 'Dedupe Outlook rules',
    detail: 'Dedupe Outlook FROM rules',
    urlContains: 'mail/rules',
    runInTab: () => {
      //const clipboard = await navigator.clipboard.readText()
      return Array.from(document.querySelectorAll('span'))
        .map(el => el.innerText?.trim())
        .filter(text => text.includes('@') && !text.includes('\n'))
    },
    process: (tab, emails) => {
      const before = emails.length
      emails = [...new Set(emails)]
      const after = emails.length
      log(before === after ? `No duplicates found in ${before} emails` : `Deduped ${before} email addresses to ${after} emails ... `)
      copy(emails.sort().join('; '))
    }
  },
  {
    title: `Download Fidelity Files`,
    detail: `Download Fidelity Treasuries and call protected CDs`,
    urlContains: 'fixedincome.fidelity.com',
    process: (tab, text) => {
      const urls = {
        CD: 'https://fixedincome.fidelity.com/ftgw/fi/FIIndividualBondsSearch?displayFormat=CSVDOWNLOAD&requestpage=FISearchCD&prodmajor=CD&prodminor=ALL&minmaturity=&minyield=&maxyield=&minmoody=&maxmoody=&minsandp=&maxsandp=&minRatings=&maxRatings=&callind=NO&scheduledCalls=&makeWholeCall=&conditionalCall=&zerocpn=&amtind=&displayFormat=TABLE&bondtierind=Y&bondotherind=Y&sinkind=&specialRedemption=&foreigndebt=&survivorsoption=&callable=&orRating=&searchResultsURL=&sortby=MA&displayFormatOverride=CSVDOWNLOAD',
        TREASURY: 'https://fixedincome.fidelity.com/ftgw/fi/FIIndividualBondsSearch?displayFormat=CSVDOWNLOAD&requestpage=FISearchTreasury&prodmajor=TREAS&prodminor=ALL&minmaturity=&callind=&scheduledCalls=&makeWholeCall=&conditionalCall=&zerocpn=&amtind=&displayFormat=TABLE&bondtierind=Y&bondotherind=Y&sinkind=&specialRedemption=&foreigndebt=&survivorsoption=&callable=&orRating=&searchResultsURL=&sortby=MA&displayFormatOverride=CSVDOWNLOAD'
      }
      const suffix = new Date().toISOString().slice(0, 10)
      Object.entries(urls)
        .map(([key, url]) => chrome.downloads.download({filename: `${key}_${suffix}.csv`, saveAs: true, url: url}))
    }
  },
  {
    title: `Bulk read links`,
    detail: `Open links in new tabs and mark them as read`,
    urlContains: 'getpocket.com/saves',
    runInTab: () => {
      const n = 10
      const links = Array.from(document.querySelectorAll('a[class="publisher"]')).slice(0, n).map(el => el.href)
      Array.from(document.querySelectorAll('button[data-cy="Archive"]')).slice(0, n).forEach(el => el.click())
      return links
    },
    process: (tab, links) => {
      log(links.join('\n'))
      links.forEach(link => open(link))
    }
  },
  {
    title: `Link Amazon Transactions`,
    detail: `Find Amazon transactions in Amazon/GMail`,
    urlContains: 'mint.intuit.com',
    runInTab: () => {
      const searchFor = 'Amazon'
      const constants = {amazon_amount_search_key: '__chrome_ai_amount', mode_key: '__chrome_ai_mode'} //TODO: auto inject
      const rows = Array.from(document.querySelectorAll('td[role="cell"]'))
        .filter(el => el.innerText === searchFor)
        .map(el => el.nextElementSibling.nextElementSibling)
      const selected = Array.from(document.querySelectorAll('input[aria-label="Description"]'))
        .filter(el => el.value === searchFor)
        .map(el => el.parentElement.parentElement.nextSibling.nextSibling)
      //TODO: document.getElementByName(name)?.remove()
      rows.concat(selected).forEach(el => {
          const insertUrl = (name, url) => {
            el.insertAdjacentHTML('afterend', `<a href="${url}" target="_blank">Find in ${name}</a><br/>`)
          }
          const amount = el.innerText.replace('-', '').replace('$', '')
          insertUrl('Amazon', `https://www.amazon.com/gp/your-account/order-history?${constants.amazon_amount_search_key}=${amount}`)
          insertUrl('GMail', `https://mail.google.com/mail/u/0/#search/amazon+${amount}`)
        })
    }
  },
  {
    urlContains: constants.amazon_amount_search_key,
    runInTab: () => {
      const amount = new URLSearchParams(window.location.search).get(constants.amazon_amount_search_key)
      window.find(amount)
    }
  }
]

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
    //process.f = (args) => { try { return process.f(args)} catch (e) { log(e) }}
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

/************************ Extension Framework Below *************************/
const extensionModes = {
  options: () => {
    $('input').change(() => $('#save').prop('disabled', false).text('Save'))

    $('#save').click(() => {
      settings = {}
      $('input').toArray().forEach((el) => {settings[el.id] = el.value})
      chrome.storage.sync.set(settings).then(() => $('#save').prop('disabled', true).text(`Saved`))
    })

    Object.entries(settings).forEach(([key, value]) => $('#' + key).val(value))
  },
  popup: async () => {
    if (!settings.openai_api_key) return extensionModes.options()
    $('#reload').click(() => chrome.runtime.reload())
    const tab = await chrome.tabs.query({active: true, lastFocusedWindow: true}).then(([tab]) => tab)
    if (!tab) return
    const selectionOrText = () => {
      const selected = window.getSelection().toString()
      return selected?.length > 10 ? selected : document.body.innerText
    }
    tools
      .filter(tool => tool.title && tab.url.includes(tool.urlContains ?? ''))
      .forEach(tool => {
        const click = () => chrome.scripting
          .executeScript({target: {tabId: tab.id}, function: tool.runInTab ?? selectionOrText})
          .then(([{result}]) =>  { if (tool.process) tool.process(tab, result) })
        $('<button>', {'data-tooltip': tool.detail ?? tool.title})
          .text(tool.title)
          .toggleClass('outline', tool.urlContains == null)
          .click(click)
          .appendTo($('#tools'))
      })
  },
  pageScript: () => tools
    .filter(tool => !tool.title && window.location.href.includes(tool.urlContains ?? ''))
    .forEach(tool => setTimeout(tool.runInTab, tool.delay ?? 1))
}

const copy = (text) => navigator.clipboard.writeText(text).then(() => sleep(100))

const open = (url, tab) => { tab ? chrome.tabs.update(tab.id, {url}) : chrome.tabs.create({url}) }

const log = (text) => $('#logs').text(text)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

chrome.storage.sync.get(null)
  .then(s => {
    settings = s
    const mode = new URL(document.location).searchParams.get(constants.mode_key) ?? 'pageScript'
    extensionModes[mode]()
    if (window.$) $('#' + mode).show()
  })
