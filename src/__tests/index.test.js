const index = require('../index.js')

let middleware, peiceCalculator, req, res, next

describe('index', () => {
  it('Returns a middleware function', () => {
    expect(typeof index()).toBe('function')
  })
  it('Throws an error if the provided request price calculator is not a function', () => {
    expect.assertions(1)
    try {
      index({ calculateRequestPrice: 'foo' })
    } catch (e) {
      expect(e.code).toEqual('ERR_INVALID_REQUEST_PRICE_CALCULATOR')
    }
  })
  describe('Returning a middleware function which', () => {
    beforeEach(() => {
      req = {
        authrite: {
          mock: true
        },
        originalUrl: 'mock'
      }
      res = {
        status: jest.fn(() => res),
        json: jest.fn(() => res)
      }
      next = jest.fn()
      priceCalculator = jest.fn(() => 100)
      middleware = index({
        calculateRequestPrice: priceCalculator
      })
    })
    it('Returns error 500 if called before an Authrite object has been populated', () => {
      delete req.authrite
      middleware(req, res, next)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'ERR_SERVER_MISCONFIGURED'
      }))
    })
  })
})
