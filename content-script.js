const amazon_amount_search_key = '__chrome_ai_amount'

const fns = {
  mint: () => {
    Array.from(document.querySelectorAll('td[role="cell"]'))
      .filter(el => el.innerText === 'Amazon')
      .map(el => el.nextElementSibling.nextElementSibling)
      .forEach(el => {
        const insertUrl = (name, url) => el.insertAdjacentHTML('afterend', `<a href="${url}" target="_blank">Find in ${name}</a><br/>`)
        const amount = el.innerText.replace('-', '').replace('$', '')
        insertUrl('Amazon', `https://www.amazon.com/gp/your-account/order-history?${amazon_amount_search_key}=${amount}`)
        insertUrl('GMail', `https://mail.google.com/mail/u/0/#search/amazon+${amount}`)
      })
  },
  amazon_search:  () => {
    const amount = new URLSearchParams(window.location.search).get(amazon_amount_search_key)
    window.find(amount)
  }
}

const main = () => {
  const url = window.location.href
  if (url.includes('mint.intuit.com')) {
    setTimeout(fns.mint, 5000)
  } else if (url.includes(amazon_amount_search_key)) {
    fns.amazon_search()
  }
}

main()
window.addEventListener('hashchange', main)