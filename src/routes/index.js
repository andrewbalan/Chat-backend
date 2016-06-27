'use strict';

let checkToken = require('middlewares/checkToken');
let auth       = require('./auth');

/**
 * Assign routes to the express application
 * @param  {Object} app     Application instance
 * @param  {Object} express Express instance
 * @return {Object}         API object
 */
module.exports = function(app, express) {
  let api = express.Router();

  api.post('/signup', auth.signup);
  api.post('/login', auth.login);
  api.get('/me', checkToken, auth.me);

  return api;
}