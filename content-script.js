const amazon_amount_search_key = '__chrome_ai_amount'

const fns = {
  mint: () => {
    Array.from(document.querySelectorAll('td[role="cell"]'))
      .filter(el => el.innerText === 'Amazon')
      .map(el => el.nextElementSibling.nextElementSibling)
      .forEach(el => {
        const amount = el.innerText.replace('-', '').replace('$', '')
        const amazonUrl = `https://www.amazon.com/gp/your-account/order-history?${amazon_amount_search_key}=${amount}`
        el.insertAdjacentHTML('afterend', `<br/><a href="${amazonUrl}" target="_blank">Find in Amazon</a>`)

        const gmailUrl = `https://mail.google.com/mail/u/0/#search/amazon+${amount}`
        el.insertAdjacentHTML('afterend', `<a href="${gmailUrl}" target="_blank">Find in GMail</a>`)
      })
  },
  amazon_search:  () => {
    const amount = new URLSearchParams(window.location.search).get(amazon_amount_search_key)
    window.find(amount)
  }
}

const url = window.location.href
if (url.includes('mint.intuit.com')) {
  setTimeout(fns.mint, 5000)
} else if (url.includes(amazon_amount_search_key)) {
  setTimeout(fns.amazon_search, 500)
}
