const amazon_amount_search_key = '__chrome_ai_amount'

const mint = () => {
  Array.from(document.querySelectorAll('td[role="cell"]'))
    .filter(el => el.innerText === 'Amazon')
    .map(el => el.nextElementSibling.nextElementSibling)
    .forEach(el => {
      const url = `https://www.amazon.com/gp/your-account/order-history?${amazon_amount_search_key}=${el.innerText}`
      el.nextElementSibling.nextElementSibling.insertAdjacentHTML('afterend', `<a href="${url}" target="_blank">Find in Amazon</a>`)
    })
}

const url = window.location.href
if (url.includes('mint.intuit.com')) {
  setTimeout(mint, 5000)
} else if (url.includes(amazon_amount_search_key)) {

}
