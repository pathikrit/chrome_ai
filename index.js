$('#gcal').on('click', () => {
  tabToText().then(log)
});

tabToText = () => chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: {tabId: tab.id}, function: () => document.body.innerText}))
    .then(([{ result }]) => result)

log = (text) => {
  console.log(text)
  $('#logs').append('\n' + text)
}
