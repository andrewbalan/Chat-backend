'use strict';

var mongoose = require('mongoose');
var crypto   = require('crypto');

var Schema = mongoose.Schema;

var userSchema = new Schema({
  name: String,
  username: {
    type: String,
    required: true,
    index: {
      unique: true
    }
  },
  salt: {
    type: String
  },
  hashedPassword: {
    type: String,
    required: true,
  },
});

userSchema.methods.encryptPassword = function (password) {
  return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
};

userSchema.methods.checkPassword = function (password) {
  return this.encryptPassword(password) === this.hashedPassword;
};

userSchema.virtual('password')
  .set(function (password) {
    this._plainPassword = password;
    this.salt = Math.random() + '';
    this.hashedPassword = this.encryptPassword(password);
  })
  .get(function () { return this._plainPassword; });


module.exports = mongoose.model('User', userSchema);