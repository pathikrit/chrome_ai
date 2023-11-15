const constants = {
  amazon_amount_search_key: '__chrome_ai_amount'
}

const pageScripts = [
  {
    urlFilter: 'mint.intuit.com',
    delay: 5000,
    fn: () => {
      Array.from(document.querySelectorAll('td[role="cell"]'))
        .filter(el => el.innerText === 'Amazon')
        .map(el => el.nextElementSibling.nextElementSibling)
        .forEach(el => {
          const insertUrl = (name, url) => el.insertAdjacentHTML('afterend', `<a href="${url}" target="_blank">Find in ${name}</a><br/>`)
          const amount = el.innerText.replace('-', '').replace('$', '')
          insertUrl('Amazon', `https://www.amazon.com/gp/your-account/order-history?${constants.amazon_amount_search_key}=${amount}`)
          insertUrl('GMail', `https://mail.google.com/mail/u/0/#search/amazon+${amount}`)
        })
    }
  },
  {
    urlFilter: constants.amazon_amount_search_key,
    fn: () => {
      const amount = new URLSearchParams(window.location.search).get(constants.amazon_amount_search_key)
      window.find(amount)
    }
  }
]

const main = () => pageScripts
  .filter(script => window.location.href.includes(script.urlFilter))
  .forEach(script => setTimeout(script.fn, script.delay ?? 1))

main()
