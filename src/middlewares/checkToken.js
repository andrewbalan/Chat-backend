'use strict';

let jsonwebtoken = require('jsonwebtoken');
let secret       = require('config').key;
let mongoose     = require('mongoose');

/**
 * Express middleware for checking token
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return next invocation
 */
module.exports = function (req, res, next) {
  let token = req.body.token ||
    req.params.token ||
    req.headers['x-access-token'];

  if (token) {
    jsonwebtoken.verify(token, secret, function (err, decoded) {
      if (err) {
        res.status(401).json({
          success: false,
          msg: "failed to authenticate user"
        });
      } else {
        req.user = decoded;
        req.user._id = mongoose.Types.ObjectId(decoded.id);
        next();
      }
    });
  } else {
    res.status(401).json({
      success: false,
      msg: "no token provided"
    });
  }
};