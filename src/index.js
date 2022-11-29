/**
 * Initializes an instance of the BSV Payment Middleware.
 * 
 * @param {Object} obj All parameters are provided in an object
 * @param {Function} obj.calculateRequestPrice A function that returns the price of the request in satoshis, given the request object as a parameter. If it returns a Promise, the middleware will wait for the Promise to resolve. If it returns 0, the middleware will proceed without requiring payment.
 * 
 * @returns {Function} The HTTP middleware that enforces a BSV payment
 */
module.exports = ({
  calculateRequestPrice = () => 100
} = {}) => {
  if (typeof calculateRequestPrice !== 'function') {
    const e = new Error(
      'The calculateRequestPrice function supplied to the payment middleware must be a function'
    )
    e.code = 'ERR_INVALID_REQUEST_PRICE_CALCULATOR'
    throw e
  }
  return async (req, res, next) => {
    if (typeof req.authrite !== 'object') {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_SERVER_MISCONFIGURED',
        description: 'The payment middleware must be executed after the request middleware'
      })
    }
    let requestPrice
    try {
      requestPrice = await calculateRequestPrice(req)
    } catch (e) {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_PAYMENT_INTERNAL',
        description: 'An internal server error occurred while paying for this request.'
      })
    }
  }
}