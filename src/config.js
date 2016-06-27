let path = require('path');

module.exports = {

  // Database settings
  database: {
    uri: 'mongodb://localhost/chat'
  },

  // Port of app
  port: process.env.PORT || 3000,

  // Secret key for hashing token
  key: 'mySecretKey',

  // Lifetime duration of token
  tokenExpires: 1440,

  // Public folder
  publicDir: path.join(__dirname, '/../public'),

  // Directory which files are uploaded to
  uploadDir: path.join(__dirname, '/../public/uploaded'),

  // Amount of messages which are loaded
  // when a user is joined chat
  numberOfMsgsToLoad: 20,
};