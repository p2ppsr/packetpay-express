# @packetpay/express

Pay with Bitcoin for HTTP requests

The code is available [on GitHub](https://github.com/p2ppsr/packetpay-express) and the package is published [on NPM](https://www.npmjs.com/package/@packetpay/express).

## Overview

[PacketPay](https://projectbabbage.com/packetpay) is a system for micropaymeent-based HTTPS request monetization.
**@packetpay/express** provides a way to easily add request monetization to the routes of an express server.

## Installation

    npm i @packetpay/express

## Example Usage

This example demonstrates creating a simple express server that makes use of the **@packetpay/express** middleware.

```js
const authrite = require('authrite-express')
const PacketPay = require('@packetpay/express')
const express = require('express')
const app = express()
const port = 5000

const TEST_SERVER_PRIVATE_KEY = 
'6dcc124be5f382be631d49ba12f61adbce33a5ac14f6ddee12de25272f943f8b'
const TEST_SERVER_BASEURL = `http://localhost:${port}`

// Before any PacketPay middleware, set up the server for Authrite
app.use(authrite.middleware({
    serverPrivateKey: TEST_SERVER_PRIVATE_KEY,
    baseUrl: TEST_SERVER_BASEURL
}))

// Configure the express server to use the PacketPay middleware
app.use(PacketPay.middleware({
    serverPrivateKey: TEST_SERVER_PRIVATE_KEY,
    baseUrl: TEST_SERVER_BASEURL
    // .....TODO (coming soon)
}))

// Example Routes
app.get('/getData', (req, res) => {
    res.json({ user: 'bob' })
}) 
app.post('/sendSomeData', (req, res) => {
    res.json({
        message: 'Hello, this is the server.',
        clientData: req.body
    })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
```

## middleware


## License

The license for the code in this repository is the Open BSV License.
