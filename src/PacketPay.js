const Ninja = require('utxoninja')

/**
 * Initializes an instance of the BSV Payment Middleware.
 * 
 * The payment middleware should be installed after the Authrite middleware.
 * 
 * @param {Object} obj All parameters are provided in an object
 * @param {String} obj.serverPrivateKey A hex-formatted 256-bit server private key. This should be the same key used to initialize the Authrite middleware.
 * @param {Function} [obj.calculateRequestPrice] A function that returns the price of the request in satoshis, given the request object as a parameter. If it returns a Promise, the middleware will wait for the Promise to resolve. If it returns 0, the middleware will proceed without requiring payment.
 * @param {object} ninjaConfig Config object for the internal [UTXONinja](https://github.com/p2ppsr/utxoninja)
 * 
 * @returns {Function} The HTTP middleware that enforces a BSV payment
 */
module.exports = ({
  calculateRequestPrice = () => 100,
  serverPrivateKey,
  ninjaConfig = {}
} = {}) => {
  if (typeof calculateRequestPrice !== 'function') {
    const e = new Error(
      'The calculateRequestPrice function supplied to the payment middleware must be a function'
    )
    e.code = 'ERR_INVALID_REQUEST_PRICE_CALCULATOR'
    throw e
  }
  if (typeof serverPrivateKey !== 'string') {
    const e = new Error('The serverPrivateKey supplied to the payment middleware must be a string')
    e.code = 'ERR_MISSING_SERVER_PRIVATE_KEY'
    throw e
  }
  const re = /[0-9a-f]{64}/g
  if (!re.test(serverPrivateKey)) {
    const e = new Error('The serverPrivateKey supplied to the payment middleware is invalid. It must be a 64-character hex string.')
    e.code = 'ERR_INVALID_SERVER_PRIVATE_KEY'
    throw e
  }
  const ninja = new Ninja({
    privateKey: serverPrivateKey,
    config: ninjaConfig
  })
  return async (req, res, next) => {
    if (typeof req.authrite !== 'object') {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_SERVER_MISCONFIGURED',
        description: 'The payment middleware must be executed after the Authrite request middleware'
      })
    }
    let requestPrice
    try {
      requestPrice = await calculateRequestPrice(req)
    } catch (e) {
      console.error(e) // Should we send these to console.eror?
      return res.status(500).json({
        status: 'error',
        code: 'ERR_PAYMENT_INTERNAL',
        description: 'An internal server error occurred while paying for this request.'
      })
    }
    // TODO: Validate requestPrice
    if (requestPrice === 0) {
      req.packetpay = {
        satoshisPaid: 0
      }
      next()
      return
    }
    let BSVPayment = req.headers['x-bsv-payment']
    if (!BSVPayment) {
      return res
        .status(402)
        .set('x-bsv-payment-satoshis-required', '' + requestPrice)
        .json({
          status: 'error',
          code: 'ERR_PAYMENT_REQUIRED',
          satoshisRequired: requestPrice,
          description: 'A BSV payment is required to complete this request. Provide the X-BSV-Payment header.'
        })
    }
    try {
      BSVPayment = JSON.parse(BSVPayment)
    } catch (e) { // TODO: test this
      return res.status(400).json({
        status: 'error',
        code: 'ERR_MALFORMED_PAYMENT',
        description: 'The value of the X-BSV-Payment header is not valid JSON and cannot be parsed.'
      })
    }
    let paymentResult
    try {
      paymentResult = await ninja.submitDirectTransaction({
        protocol: '3241645161d8',
        senderIdentityKey: req.authrite.identityKey,
        note: `Payment for ${req.originalUrl}`,
        amount: requestPrice,
        derivationPrefix: BSVPayment.derivationPrefix,
        transaction: BSVPayment.transaction
      })
      if (paymentResult.status !== 'success') {
        throw new Error('Payment not processed')
      }
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        code: e.code || 'ERR_PAYMENT_FAILED',
        description: e.message
      })
    }
    req.packetpay = {
      satoshisPaid: requestPrice,
      reference: paymentResult.reference
    }
    res.set('x-bsv-payment-reference', paymentResult.reference)
    next()
  }
}