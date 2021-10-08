// require necessary NPM packages
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
// const http = require('http')
const { Server } = require('socket.io')

// require route files
const exampleRoutes = require('./app/routes/example_routes')
const userRoutes = require('./app/routes/user_routes')

// require middleware
const errorHandler = require('./lib/error_handler')
const requestLogger = require('./lib/request_logger')

// require database configuration logic
// `db` will be the actual Mongo URI as a string
const db = require('./config/db')

// require configured passport authentication middleware
const auth = require('./lib/auth')

// define server and client ports
// used for cors and local port declaration
const serverDevPort = 4741
const clientDevPort = 7165

// establish database connection
// use new version of URL parser
// use createIndex instead of deprecated ensureIndex
mongoose.connect(db, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
})

// instantiate express application object
const app = express()

// set CORS headers on response from this API using the `cors` NPM package
// `CLIENT_ORIGIN` is an environment variable that will be set on Heroku
app.use(cors({ origin: process.env.CLIENT_ORIGIN || `http://localhost:${clientDevPort}` }))

// define port for API to run on
const port = process.env.PORT || serverDevPort

// register passport authentication middleware
app.use(auth)

// add `express.json` middleware which will parse JSON requests into
// JS objects before they reach the route files.
// The method `.use` sets up middleware for the Express application
app.use(express.json())
// this parses requests sent by `$.ajax`, which use a different content type
app.use(express.urlencoded({ extended: true }))

// log each request as it comes in for debugging
app.use(requestLogger)

// register route files
app.use(exampleRoutes)
app.use(userRoutes)

// register error handling middleware
// note that this comes after the route middleware, because it needs to be
// passed any error messages from them
app.use(errorHandler)

// run API on designated port (4741 in this case)
const server = app.listen(port, () => {
  console.log('listening on port ' + port)
})

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

io.on('connection', (socket) => {
  console.log('socket id', socket.id)
  // event of joining room from front end
  socket.on('join_room', (roomData) => {
    socket.join(roomData)
    console.log(`Socket with id: ${socket.id} joined room: ${roomData}`)
  })

  // handles message data sent from server
  socket.on('send_message', (messageData) => {
    console.log('messageData from client', messageData)
    // emits messageData to client to specific room
    socket.to(messageData.room).emit('receive_message', messageData)
  })

  // disconnect from socket
  socket.on('disconnect', () => {
    console.log('user disconnect', socket.id)
  })
})

// needed for testing
module.exports = app
