const constants = {
  my_maps_search_key: '__chrome_ai_loc',
  amazon_amount_search_key: '__chrome_ai_amount',
  mode_key: '__chrome_ai_mode'
}

Array.prototype.distinct = function() { return [...new Set(this)] }  // can only be used in the process and not in runInTab(); dont change to arrow function

/**
 * Each tool has the following items:
 *  title: (required) Describe this script
 *  detail: (Optional) popup hover text; defaults to title
 *  urlContains: (Optional) Only enable if window.location.href contains this string
 *  runInTab: (Optional) Run this in the page; defaults to "get selected text or all document text"
 *  delay: (Optional) Delay in ms before running the above script (default is 100ms)
 *  inject: (Optional) If true, always inject the runInTab script into the page
 *  process: (Optional) Process the data returned from above function
 */
const tools = [
  {
    title: 'Summarize Page',
    detail: 'Summarizes this webpage',
    process: (pageHtml, tab) => $.post(`https://webpage-summarizer-q9f1.onrender.com/summarize?url=${encodeURIComponent(tab.url)}`, pageHtml).then(res => open(res.resultUrl))
  },
  {
    title: 'Remove Paywall',
    process: (pageHtml, tab) => open(`https://12ft.io/${encodeURIComponent(tab.url)}`, tab)
  },
  {
    title: 'Save all tabs to Pocket',
    detail: 'Save all tabs in this window to Pocket',
    process: () => chrome.tabs.query({currentWindow: true})
      .then(tabs => Promise.all(tabs.map(tab => open(`https://getpocket.com/edit?url=${encodeURIComponent(tab.url)}`, tab))))
      .then(redirects => log(`Saved ${redirects.length} tabs to Pocket`))
  },
  {
    title: 'Auto group tabs',
    process: (page, tab, settings) => {
      chrome.windows.getAll()
        .then(windows => Promise.all(windows.flatMap(w => chrome.tabs.query({windowId: w.id}))))
        .then(tabs => tabs.flat())
        .then(tabs => tabs.map(tab => ({id: tab.id, url: tab.url.split('?')[0], title: tab.title}))) //TODO: Also parse header from page?
        .then(tabs => askChatGpt(
          settings.openai_api_key,
          `
            I have the following tabs open in my browser. Please group them into categories.
            Some example categories would be "coding", "finance", "travel", "news", "shopping", "amazon" etc. but feel free to create your own categories.
            If any page looks like tickets (for movies, shows or activities) or reservations (for restaurants & bars) use the category "date night"


            ${JSON.stringify(tabs, null, 2)}
          `,
          {
            f: (arg) => {
              const groupTabs = (tabIds, group) => chrome.tabs.group({tabIds}).then(groupId => chrome.tabGroups.update(groupId, {title: group, collapsed: true}))
              const validIds = tabs.map(tab => tab.id) // Sometimes chatgpt hallucinates and gives invalid ids
              const misc = [] // Tabs that don't fit into any category
              for (let i = 0; i < Math.min(arg.categories.length, arg.tabIds.length); i++) {
                const category = arg.categories[i]
                const tabIds = arg.tabIds[i].filter(id => validIds.includes(id))
                if (tabIds.length > 1) groupTabs(tabIds, category)
                else misc.push(...tabIds)
              }
              if (misc.length) groupTabs(misc, 'misc')
            },
            schema: {
              name: 'group_tabs',
              description: 'Groups tabs into categories',
              parameters: {
                type: "object",
                properties: {
                  categories: {type: "array", items: {type: "string"}, description: "List of detected categories"},
                  tabIds: {type: "array", items: {type: "array", items: {type: "integer"}}, description: "List of tab ids in each category (in same order as categories)"}
                }
              }
            }
          }
        )
      )
    }
  },
  {
    title: 'To Google Calendar',
    detail: 'Create Google calendar invite from contents of this page',
    process: (pageHtml, tab) => $.post(`https://webpage-summarizer-q9f1.onrender.com/calendarize?url=${encodeURIComponent(tab.url)}`, pageHtml).then(res => open(res.resultUrl))
  },
  {
    title: 'Extract to a list',
    detail: 'Extract items from this page into a list',
    runInTab: () => {
      const tags = ['h1', 'h2', 'h3', 'h4', /*'h5', 'h6', 'b', 'strong'*/]
      const bigs = tags.flatMap(tag => Array.from(document.querySelectorAll(tag)))
      const bolds = [] //Array.from(document.querySelectorAll('*')).filter(el => getComputedStyle(el).fontWeight > 400)
      return bigs.concat(bolds).map(el => el.innerText.trim())
    },
    process: (bolds) => {
      copy(bolds.distinct().join('\n'))
        .then(() => {
          log(`Copied ${bolds.length} items`)
          open('https://vscode.dev/')
        })
    }
  },
  {
    title: 'Add to Google Maps',
    detail: 'Bulk add items to Google Maps',
    process: () => dialog('add_to_maps', () => {
      $('add_to_maps_prompt').val()
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .distinct()
        .forEach(item => open(`${settings.google_my_maps_url}&${constants.my_maps_search_key}=${item}`))
    }),
  },
  {
    title: 'To Outlook rules',
    detail: 'Create Outlook filter with selected emails',
    urlContains: 'outlook.live.com',
    runInTab: () => Array.from(document.querySelectorAll('div[aria-selected="true"] span[title*="@"]')).map(el => el.title),
    process: (emails) => {
      if (emails && emails.length > 0) {
        copy(emails.distinct().join('; ')).then(() => open('https://outlook.live.com/mail/0/options/mail/rules'))
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
    process: (emails) => {
      const before = emails.length
      emails = emails.distinct()
      const after = emails.length
      log(before === after ? `No duplicates found in ${before} emails` : `Deduped ${before} email addresses to ${after} emails ... `)
      copy(emails.sort().join('; '))
    }
  },
  {
    title: 'Download Fidelity Files',
    detail: 'Download Fidelity Treasuries and call protected CDs',
    urlContains: 'fixedincome.fidelity.com',
    process: () => {
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
    title: 'Bulk read links',
    detail: 'Open links in new tabs and mark them as read',
    urlContains: 'getpocket.com/saves',
    runInTab: () => {
      const n = 10
      const links = Array.from(document.querySelectorAll('a[class="publisher"]')).slice(0, n).map(el => el.href)
      Array.from(document.querySelectorAll('button[data-tooltip="Archive"]')).slice(0, n).forEach(el => el.click())
      return links
    },
    process: (links) => {
      log(links.join('\n'))
      links.forEach(link => open(link))
    }
  },
  {
    title: 'My Maps Helper',
    urlContains: constants.my_maps_search_key,
    delay: 3000,
    inject: true,
    runInTab: (settings, constants) => {
      const loc = new URLSearchParams(window.location.search).get(constants.my_maps_search_key)
      document.getElementById('mapsprosearch-field').value = loc
      Array.from(document.getElementById('mapsprosearch-button').children)[0].click()
    }
  },
  {
    title: 'Copy Fidelity Baskets',
    urlContains: 'digital.fidelity.com/ftgw/digital/sdp-dashboard',
    runInTab: () => {
      const order = ['Trend', 'Bond', 'Inflation Hedge', 'Drawdown', 'Value', 'International', 'Geopolitics']
      Array.from(document.querySelectorAll('.kits-list-table-item')).forEach(el => {
        const name = el.querySelector('.kit-name-container').innerText.trim()
        let balance = el.querySelector('.kit-current-balance span').innerText.trim()
        if (!balance.startsWith('$')) balance = name
        const idx = order.findIndex(item => name.startsWith(item))
        if (idx >= 0) order[idx] = balance
      })
      return order
    },
    process: (balances) => copy(balances.join('\n')).then(() => window.close())
  },
  {
    title: 'Auto-refresh Fidelity',
    urlContains: 'digital.fidelity.com',
    inject: true,
    runInTab: (settings, constants) => setInterval(() => {
      console.log('Preventing Fidelity logout ...')
      document.getElementsByClassName('posweb-grid_top-refresh-icon')?.item(0)?.click()
    }, 1000 * 60 * 1) // Click every 1 minutes
  }
]
tools.sort((t1, t2) => t1.title.localeCompare(t2.title))

const askChatGpt = (
  apiKey,
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
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey},
    data: JSON.stringify(data)
  }).then(res => {
    log(`Parsing response from ${model} ...`)
    const gptFn = res?.choices?.[0]?.message?.tool_calls?.[0]?.function
    if (fn && gptFn?.arguments) {
      return fn.f(JSON.parse(gptFn?.arguments))
    } else {
      return res?.choices?.[0]?.message?.content
    }
  }).catch(e => log(JSON.stringify(e)))
}

/************************ Extension Framework Below *************************/
const extensionModes = {
  options: (settings) => {
    $('input').change(() => $('#save').prop('disabled', false).text('Save'))

    $('#save').click(() => {
      settings = {}
      $('input').toArray().forEach((el) => {settings[el.id] = el.value})
      chrome.storage.sync.set(settings).then(() => $('#save').prop('disabled', true).text(`Saved`))
    })

    Object.entries(settings).forEach(([key, value]) => $('#' + key).val(value))
  },
  popup: async (settings) => {
    if (!settings.openai_api_key) return extensionModes.options()
    const tab = await chrome.tabs.query({active: true, lastFocusedWindow: true}).then(([tab]) => tab)
    if (!tab) return
    const selectionOrText = () => {
      const selected = window.getSelection().toString()
      return selected?.length > 10 ? selected : document.body.innerHTML
    }
    tools
      .filter(tool => tab.url.includes(tool.urlContains ?? ''))
      .forEach(tool => {
        const click = () => chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: tool.runInTab ?? selectionOrText,
            args: [settings, constants]
          })
          .then(([{result}]) =>  { if (tool.process) tool.process(result, tab, settings) })
        $('<button>', {'data-tooltip': tool.detail ?? tool.title})
          .text(tool.title + (tool.inject ? ' (Injected)' : ''))
          .toggleClass('outline', tool.urlContains == null)
          .click(click)
          .appendTo($('#tools'))
      })
  },
  pageScript: (settings) => tools
    .filter(tool => tool.inject && window.location.href.includes(tool.urlContains ?? ''))
    .forEach(tool => setTimeout(() => tool.runInTab(settings, constants), tool.delay ?? 100))
}

const dialog = (id, f) => {
  $('#' + id).prop('open', true)
  $(`#${id} :submit`).click(() => {
    $('#' + id).removeAttr('open')
    f()
  })
}

const copy = (text) => navigator.clipboard.writeText(text).then(() => sleep(100))

const open = (url, tab) => { tab ? chrome.tabs.update(tab.id, {url}) : chrome.tabs.create({url}) }

const log = (text) => $('#logs').text(text)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

chrome.storage.sync.get(null).then(settings => {
  const mode = new URL(document.location).searchParams.get(constants.mode_key) ?? 'pageScript'
  extensionModes[mode](settings)
  if (window.$) {
    $('#reload').click(() => chrome.runtime.reload())
    $('#' + mode).show()
  }
})
