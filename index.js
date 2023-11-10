document.getElementById('gcal').addEventListener('click', async () => {
  const tab = await getCurrentTab()
  console.log(tab)
});

async function getCurrentTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  console.log(activeTab)
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    function: () => document.body.innerText,
  });

  console.log(result)
  return activeTab
}

