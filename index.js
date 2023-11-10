document.getElementById('gcal').addEventListener('click', async () => {
  const tab = await tabToText()
  document.getElementById('output').textContent = tab
  console.log(tab)
});

tabToText = () =>
  chrome.tabs.query({active: true, lastFocusedWindow: true})
    .then(([tab]) => chrome.scripting.executeScript({target: { tabId: tab.id }, function: () => document.body.innerText}))
    .then(([{ result }]) => result)
