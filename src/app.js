'use strict';

const NODE_ENV = process.env.NODE_ENV;

let express          = require('express');
let bodyParser       = require('body-parser');
let expressValidator = require('express-validator');
let morgan           = require('morgan');
let mongoose         = require('mongoose');
let config           = require('config');
let path             = require('path');


let app = express();
let api = require('routes')(app, express);


// Connect database
mongoose.connect(config.database.uri, err => {
  if (err) {
    console.error(err);
  } else {
    if (NODE_ENV !== 'test') console.info('Connected to the database');
  }
});

// CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'x-access-token, Overwrite, Destination, Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control');
  next();
});

// Logger
if (NODE_ENV !== 'test') app.use(morgan('dev'));

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(expressValidator());
app.use('/api', api);

app.use(express.static(config.publicDir));

app.get('/*', function (req, res) {
  res.sendFile(path.join(config.publicDir, '/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  res.json({
    msg: err.message || 'internal server error',
  });
});

// Create server
let server = app.listen(config.port, (err, res) => {
  if (err) {
    console.error(err);
  } else {
    if (NODE_ENV !== 'test') console.log('Listening on port ', config.port);
  }
});

// Connect sockets
require('socket')(server);


module.exports = app;