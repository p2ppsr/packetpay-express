# @packetpay/express

Pay with Bitcoin for HTTP requests

The code is available [on GitHub](https://github.com/p2ppsr/packetpay-express) and the package is published [on NPM](https://www.npmjs.com/package/@packetpay/express).

## Overview

[PacketPay](https://projectbabbage.com/packetpay) is a system for micropayment-based HTTPS request monetization.
**@packetpay/express** provides a way to easily add request monetization to the routes of an express server.

The middleware relies on [Authrite](https://projectbabbage.com/authrite) for verifying the legitimacy of users. When users provide the `x-bsv-payment` header, the PackePay middleware processes and validates the payment.

When no `x-bsv-payment` header is provided, the middleware terminates the request with a **402: Payment Required** error containing the amount for the payment.

The format of the `x-bsv-payment` header is a JSON object containing a payment envelope that complies with a Babbage payment protocol. More details on this protocol are coming soon.

There is a complementary client library called [@packetpay/js](https://github.com/p2ppsr/packetpay-js) that interfaces with this middleware and generates the correct payment information.

## Installation

    npm i @packetpay/express

## Example Usage

This example demonstrates creating a simple express server that makes use of the **@packetpay/express** middleware.

```js
const authrite = require('authrite-express')
const PacketPay = require('@packetpay/express')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 5000
const TEST_SERVER_PRIVATE_KEY = 
'6dcc124be5f382be631d49ba12f61adbce33a5ac14f6ddee12de25272f943f8b'
const TEST_SERVER_BASEURL = `http://localhost:${port}`

app.use(bodyParser.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Before any PacketPay middleware, set up the server for Authrite
app.use(authrite.middleware({
    serverPrivateKey: TEST_SERVER_PRIVATE_KEY,
    baseUrl: TEST_SERVER_BASEURL
}))

// Configure the express server to use the PacketPay middleware
app.use(PacketPay({
    serverPrivateKey: TEST_SERVER_PRIVATE_KEY,
    ninjaConfig: {
      // Use the Babbage staging testnet Dojo
      dojoURL: 'https://staging-dojo.babbage.systems'
    },
    calculateRequestPrice: req => {
        if (req.originalUrl === '/buyTShirt') {
            return 5 * 1e8 // 5 BSV for T-shirts
        } else if (req.originalUrl === '/specialFile.pdf') {
            return 3301 // 3,301 satoshis for the PDF file
        } else {
            return 200 // 200 satoshis for everything else
        }
    }
}))

// Example Routes
app.get('/buyTShirt', (req, res) => { // costs 5 BSV
    // Verify the payment
    if (req.packetpay.satoshisPaid === 5 * 1e8) {
        /* Mark the T-shirt order as ready to ship */
        res.status(200).json({
            message: `Your T-shirt is on the way! Payment reference number: ${req.packetpay.reference}`
        })
    } else {
        res.status(400).json({
            message: 'Payment for T-shirt not received!'
        })
    }
})
app.post('/sendSomeData', (req, res) => { // costs 200 sats
    res.json({
        message: 'Hello, this is the server.',
        clientData: req.body
    })
})

// Every file costs 200 sats. But "/specialFile.pdf" costs 3301 sats.
app.use(express.static('files'))

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
```

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

*   [PacketPay](#packetpay)
    *   [Parameters](#parameters)

### PacketPay

Initializes an instance of the BSV Payment Middleware.

The payment middleware should be installed after the Authrite middleware.

#### Parameters

*   `obj` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** All parameters are provided in an object (optional, default `{}`)

    *   `obj.calculateRequestPrice` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)?** A function that returns the price of the request in satoshis, given the request object as a parameter. If it returns a Promise, the middleware will wait for the Promise to resolve. If it returns 0, the middleware will proceed without requiring payment. (optional, default `()=>100`)
    *   `obj.serverPrivateKey` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** A hex-formatted 256-bit server private key. This should be the same key used to initialize the Authrite middleware.
    *   `obj.ninjaConfig` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?** Config object for the internal [UTXONinja](https://github.com/p2ppsr/utxoninja) (optional, default `{}`)

Returns **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** The HTTP middleware that enforces a BSV payment

## License

The license for the code in this repository is the Open BSV License.
