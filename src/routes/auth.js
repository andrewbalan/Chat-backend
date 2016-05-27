'use strict';

let User        = require('models/user');
let createToken = require('lib/createToken');

module.exports = {
  signup: (req, res, next) => {
    let params = ['name', 'username', 'password'];
    
    for (let i in params) {
      req.assert(params[i], '3 to 20 characters required').len(3, 20);
      req.assert(params[i], 'only letters and numbers are allowed').isAlphanumeric();
      req.assert(params[i], 'field is required').notEmpty();
    }

    let errors = req.validationErrors(true);

    if (errors) {
      res.status(400).json(errors);
    } else {
      let user = new User({
        name: req.body.name,
        username: req.body.username,
        password: req.body.password
      });

      user.save(err => {
        if (err && err.code === 11000) {
          return res.status(400).json({
            username: {
              msg: 'username already exists'
            }
          });
        }

        if (err) {
          return next(err);
        }

        let token = createToken(user);
        res.status(200).json({
          msg: 'user has been created',
          token: token
        });
      });
    }
  },

  login: (req, res, next) => {
    User.findOne({
      username: req.body.username
    }, (err, user) => {
      if (err) return next(err);

      if (!user) {
        res.status(404).json({
          username: {
            msg: 'user doesn\'t exist'
          }
        });
      } else {
        if (req.body.password && user.checkPassword(req.body.password)) {

          let token = createToken(user);

          res.status(200).json({
            success: true,
            msg: 'successfuly login',
            token: token
          });
        } else {
          res.status(400).json({
            password: {
              msg: 'invalid password'
            }
          });
        }
      }
    });
  }
};