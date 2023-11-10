document.getElementById('gcal').addEventListener('click', async () => {
  const text = await tabToText()
  log(text)
});

tabToText = () => chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: {tabId: tab.id}, function: () => document.body.innerText}))
    .then(([{ result }]) => result)

log = (text) => {
  console.log(text)
  document.getElementById('logs').textContent += '\n' + text
}
