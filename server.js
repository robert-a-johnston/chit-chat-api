// require necessary NPM packages
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const cors = require('cors')
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:7165',
    methods: ['GET', 'POST']
  }
})

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
// const user = require('./app/models/user')

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
// const app = express()

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
server.listen(port, () => {
  console.log('listening on port ' + port)
})

let users = []
// filters users so that they do not keep adding users
const addUser = (userId, socketId) => {
  console.log('in addUser, id, socketId', userId, socketId)
  if ((!users.some(user => user.userId === userId)) && (socketId !== undefined)) {
    users.push({userId, socketId})
  }
}

io.on('connection', (socket) => {
  socket.on('join_room', (roomData) => {
    socket.join(roomData.room)
    console.log('socket id', socket.id)
    console.log('name ', roomData)
    console.log(`Stringified object joined room: ${JSON.stringify(roomData)}`)
    addUser(roomData.name, socket.id)
  })
  // take userID and socket ID sends users to client
  socket.on('addUser', (userId) => {
    addUser(userId, socket.Id)
    io.emit('getUsers', users)
  })
  // handles message data sent from server
  socket.on('message', (messageData) => {
    console.log('messageData from client', messageData)
    console.log('room', messageData.room)
    // emits messageData to client to specific room
    io.to(messageData.room).emit('receive_message', messageData)
  })

  // disconnect from socket
  socket.on('disconnect', () => {
    socket.emit('message', 'User left')
    console.log('user disconnect', socket.id)
  })
})

// needed for testing
module.exports = app
