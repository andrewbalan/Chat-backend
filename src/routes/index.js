'use strict';

var checkToken = require('middlewares/checkToken');
var auth       = require('./auth');
var chat       = require('./chat');

module.exports = function(app, express) {
  var api = express.Router();

  api.post('/signup', auth.signup);
  api.post('/login', auth.login);
  api.post('/chat', checkToken, chat.create);
  api.get('/chat/opened', checkToken, chat.opened);
  api.get('/chat/available', checkToken, chat.available);
  api.put('/chat/join/:id', checkToken, chat.join);
  api.put('/chat/leave/:id', checkToken, chat.leave);
  api.delete('/chat/:id', checkToken, chat.delete);

  api.get('/me', checkToken, (req, res, next) => {
    res.json(req.user);
  });

  return api;
}