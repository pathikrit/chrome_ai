$('#save').click(() => {
  settings = {}
  $('input').toArray().forEach((el) => {settings[el.id] = el.value})
  chrome.storage.sync.set(settings).then(() => $('#save').prop('disabled', true).text(`Saved ${settings}`))
})

$(document).ready(() => {
  $('input').change(() => $('#save').prop('disabled', false).text('Save'))

  chrome.storage.sync.get(null)
    .then((settings) => {
      for (const [key, value] of Object.entries(settings)) {
        $('#' + key).val(value)
      }
    })
})
