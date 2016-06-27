'use strict';

var app = require('app');

require('./models/user')(app);
require('./models/chat')(app);

require('./routes/auth')(app);

require('./sockets/chat')(app);