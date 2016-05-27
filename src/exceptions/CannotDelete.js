'use strict';

let util = require('util');

let CannotDeleteException = function (message, status) {
  Error.call(this);
  this.message    = message || 'cannot delete';
  this.statusCode = 404 || status;
}

util.inherits(CannotDeleteException, Error);

module.exports = CannotDeleteException;