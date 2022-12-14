global.self = global
global.window = {}

const PacketPay = require('../PacketPay.js')
const Ninja = require('utxoninja')

jest.mock('utxoninja')

const TEST_SERVER_PRIVATE_KEY = '430077830e91657893014e9b7cedd005f77d2801a3932cf0a79741acf2330ee1'

let middleware, peiceCalculator, req, res, next, mockSubmitDirectTransaction

describe('PacketPay Server Middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })
  it('Returns a middleware function', () => {
    expect(typeof PacketPay({
      serverPrivateKey: TEST_SERVER_PRIVATE_KEY
    })).toBe('function')
  })
  it('Throws an error if the provided request price calculator is not a function', () => {
    expect.assertions(1)
    try {
      PacketPay({ calculateRequestPrice: 'foo' })
    } catch (e) {
      expect(e.code).toEqual('ERR_INVALID_REQUEST_PRICE_CALCULATOR')
    }
  })
  it('Throws an error if the server private key is missing', () => {
    expect.assertions(1)
    try {
      PacketPay({})
    } catch (e) {
      expect(e.code).toEqual('ERR_MISSING_SERVER_PRIVATE_KEY')
    }
  })
  it('Throws an error if the provided server private key is not valid', () => {
    expect.assertions(1)
    try {
      PacketPay({ serverPrivateKey: 'foo' })
    } catch (e) {
      expect(e.code).toEqual('ERR_INVALID_SERVER_PRIVATE_KEY')
    }
  })
  it('Constructs a new Ninja with the provided private key', () => {
    PacketPay({
      serverPrivateKey: TEST_SERVER_PRIVATE_KEY,
      ninjaConfig: {
        dojoURL: 'https://staging-dojo.babbage.systems'
      }
    })
    expect(Ninja).toHaveBeenCalledWith({
      privateKey: TEST_SERVER_PRIVATE_KEY,
      config: {
        dojoURL: 'https://staging-dojo.babbage.systems'
      }
    })
  })
  describe('Returns a middleware function which:', () => {
    beforeEach(() => {
      req = {
        authrite: {
          identityKey: 'mock_authrite_ik',
          certificates: []
        },
        headers: {
          'x-bsv-payment': JSON.stringify({
            protocol: '3241645161d8',
            derivationPrefix: 'mock_dp',
            transaction: {
              rawTx: 'mock_rw_tx',
              inputs: 'mock_inputs',
              mapiResponses: 'mock_mapi_responses',
              outputs: [{
                vout: 0,
                satoshis: 100,
                derivationSuffix: 'mock_ds'
              }]
            }
          })
        },
        get: x => req.headers[x.toLowerCase()],
        originalUrl: '/mock_orig_url'
      }
      res = {
        status: jest.fn(() => res),
        set: jest.fn(() => res),
        json: jest.fn(() => res)
      }
      next = jest.fn()
      priceCalculator = jest.fn(() => 100)
      mockSubmitDirectTransaction = jest.fn(() => {
        return {
          status: 'success',
          reference: 'mock_ref'
        }
      })
      Ninja.mockImplementation(() => {
        return {
          submitDirectTransaction: mockSubmitDirectTransaction
        }
      })
    })
    it('Returns error 500 if called before an Authrite object has been populated', async () => {
      delete req.authrite
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'ERR_SERVER_MISCONFIGURED'
      }))
    })
    it('Uses the request price calculator to obtain the price of the HTTP request', async () => {
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(priceCalculator).toHaveBeenCalledWith(req)
    })
    it('Returns error 500 if the request price calculator throws an error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
      priceCalculator.mockImplementation(() => {
        throw new Error('Bad thing')
      })
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'ERR_PAYMENT_INTERNAL'
      }))
      expect(console.error).toHaveBeenCalled()
    })
    it('Calls next with zero amount if price calculator returns 0', async () => {
      priceCalculator.mockReturnValue(0)
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(req.packetpay).toEqual({
        satoshisPaid: 0
      })
    })
    it('Waits for a promise result from the price calculator', async () => {
      priceCalculator.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 42
      })
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(next).toHaveBeenCalledTimes(1)
      expect(req.packetpay).toEqual({
        satoshisPaid: 42,
        reference: 'mock_ref'
      })
    })
    it('Returns error 402 with the required payment amount when no X-BSV-Payment header is sent', async () => {
      delete req.headers['x-bsv-payment']
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(402)
      expect(res.set).toHaveBeenCalledWith('x-bsv-payment-satoshis-required', '100')
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'ERR_PAYMENT_REQUIRED',
        satoshisRequired: 100,
        description: 'A BSV payment is required to complete this request. Provide the X-BSV-Payment header.'
      })
    })
    it('Uses Ninja submitDirectTransaction to submit the X-BSV-Payment header', async () => {
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(mockSubmitDirectTransaction).toHaveBeenCalledWith({
        amount: 100,
        protocol: '3241645161d8',
        senderIdentityKey: 'mock_authrite_ik',
        note: 'Payment for /mock_orig_url',
        derivationPrefix: 'mock_dp',
        transaction: {
          rawTx: 'mock_rw_tx',
          inputs: 'mock_inputs',
          mapiResponses: 'mock_mapi_responses',
          outputs: [{
            vout: 0,
            satoshis: 100,
            derivationSuffix: 'mock_ds'
          }]
        }
      })
    })
    it('Returns 400 errors when submitDirectTransaction throws errors', async () => {
      Ninja.mockImplementation(() => {
        return {
          submitDirectTransaction: () => {
            let e = new Error('Bad thing')
            e.code = 'ERR_BAD_THING'
            throw e
          }
        }
      })
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'ERR_BAD_THING',
        description: 'Bad thing'
      })
    })
    it('Properly sets the packetpay req object with the correct payment amount, calling the next function', async () => {
      middleware = PacketPay({
        calculateRequestPrice: priceCalculator,
        serverPrivateKey: TEST_SERVER_PRIVATE_KEY
      })
      await middleware(req, res, next)
      expect(req.packetpay).toEqual({
        satoshisPaid: 100,
        reference: 'mock_ref'
      })
      expect(next).toHaveBeenCalledTimes(1)
    })
  })
})
