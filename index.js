document.getElementById('gcal').addEventListener('click', async () => {
  const tab = await getCurrentTab()
  console.log(tab)
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}