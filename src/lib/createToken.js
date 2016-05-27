'use strict';

var jsonwebtoken = require('jsonwebtoken');
var secretKey    = require('config').key;

module.exports = function createToken(user) {
  var token = jsonwebtoken.sign({
    id: user._id,
    name: user.name,
    username: user.username
  }, secretKey, {
    expiresInMinute: 1440
  });
  return token;
}