const amazon_amount_search_key = '__chrome_ai_amount'

const fns = {
  mint: () => {
    Array.from(document.querySelectorAll('td[role="cell"]'))
      .filter(el => el.innerText === 'Amazon')
      .map(el => el.nextElementSibling.nextElementSibling)
      .forEach(el => {
        const url = `https://www.amazon.com/gp/your-account/order-history?${amazon_amount_search_key}=${el.innerText}`
        el.nextElementSibling.nextElementSibling.insertAdjacentHTML('afterend', `<a href="${url}" target="_blank">Find in Amazon</a>`)
      })
  },
  amazon_search:  () => {
    const amount = new URLSearchParams(window.location.search).get(amazon_amount_search_key).replace('-$', '')
    console.log(amount)
  }
}

const url = window.location.href
let fn = undefined
if (url.includes('mint.intuit.com')) {
  fn = fns.mint
} else if (url.includes(amazon_amount_search_key)) {
  fn = fns.amazon_search
}
setTimeout(fn, 5000)
