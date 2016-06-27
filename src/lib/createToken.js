'use strict';

var jsonwebtoken = require('jsonwebtoken');
var secretKey    = require('config').key;
var tokenExpires = require('config').tokenExpires;

/**
 * Return a token
 * @param  {Object} user
 * @return {String}
 */
module.exports = function createToken(user) {
  var token = jsonwebtoken.sign({
    id: user._id,
    name: user.name,
    username: user.username
  }, secretKey, {
    expiresInMinute: tokenExpires
  });
  return token;
};