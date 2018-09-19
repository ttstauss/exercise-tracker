const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')
const moment = require('moment')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )


/** set up mongoose schema **/
const Schema = mongoose.Schema

const userSchema = new Schema({
  username: {
    type: String,
    required: true
  }
})

const logSchema = new Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

const User = mongoose.model('User', userSchema)
const ExerciseLog = mongoose.model('ExerciseLog', logSchema)

/** db functions **/
const createAndSaveUser = (username, done) => {
  const user = new User({username})
  user.save((err, data) => {
    if(err) return done(err)
    return done(null, data)
  })
}

const getUser = (userId, done) => {
  User.findById(userId, (err, data) => {
    if(err) return done(err)
    return done(null, data)
  })
}

const getUsers = done => {
 User.find({}, (err, data) => {
   if(err) return done(err)
   return done(null, data)
 })
}

const addExercise = ({userId, description, duration, date}, done) => {
  date = date === '' ? undefined : date
  const log = new ExerciseLog({userId, description, duration, date})
  log.save((err, data) => {
    if(err) return done(err)
    return done(null, data)
  })
}

const getLogByUser = (userId, from, to, limit = 0, done) => {
  let query = { $and: [{userId}]}
  
  if (from) {query.$and.push({ date: { '$gt': from} })}
  if (to) {query.$and.push({ date: { '$lt': to} })}
  
  query = ExerciseLog.find(query)
  query.limit(+limit)
  query.exec((err, data) => {
         if(err) return done(err)
         return done(null, data)
       })
}


app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res) => {
  createAndSaveUser(req.body.username, (err, data) => {
    res.json({
      _id: data._id,
      username: data.username
    }) 
  })
})

app.get('/api/exercise/users', (req, res) => {
  getUsers((err, data) => {
    res.json(data)
  })
})

app.post('/api/exercise/add', (req, res) => {
  addExercise(req.body, (err, {userId, description, duration, date}) => {
    getUser(userId, (err, {_id, username}) => {
      res.json({
        _id,
        username,
        description,
        duration,
        date: date.toDateString()
      })
    })
  })
})

app.get('/api/exercise/log', (req, res) => {
  const userId = req.query.userId
  let from = req.query.from
  let to = req.query.to
  const limit = req.query.limit
  getLogByUser(userId, from, to, limit, (err, data) => {
    const log = data.map(({description, duration, date}) => ({description, duration, date: date.toDateString()}))
    
    console.log('from', from)
    console.log('to', to)
    
    from = !from ? from : moment(from).isValid() ? moment(from).format('ddd MMM DD YYYY') : undefined
    to = !to ? to : moment(to).isValid() ? moment(to).format('ddd MMM DD YYYY') : undefined
    getUser(userId, (err, {username}) => {
      res.json({
        _id: userId,
        username,
        from,
        to,
        limit: +limit,
        count: log.length,
        log
      })
    })
  })
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
