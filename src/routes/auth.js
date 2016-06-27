'use strict';

let path                   = require('path');
let co                     = require('co');
let fs                     = require('co-fs');
let formidable             = require('formidable');
let User                   = require('models/user');
let createToken            = require('lib/createToken');
let getValidationErrors    = require('lib/getValidationErrors');
let generateRandomFilename = require('lib/generateRandomFilename');

const DIR = require('config').uploadDir;

module.exports = {

  /**
   * Signup route
   * @param  {Object}   req
   * @param  {Object}   res
   * @param  {Function} next
   */
  signup: (req, res, next) => {
    let form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {
      if (err) return next(err);

      // 1.Input filtering
      let validationRules = require('./validationRules').signup;

      fields.avatar = files['avatar'];

      let errors = getValidationErrors(fields, validationRules);

      co(function* () {
        if (errors) {
          // Remove temp file
          if (fields.avatar) yield fs.unlink(fields.avatar.path);

          return res.status(400).json({
            errors: errors
          });
        } else {
          // Generate filename
          let extension = path.extname(fields.avatar.name);
          let filename  = generateRandomFilename(extension);
          let filepath  = DIR;

          let user = new User({
            name: fields.name,
            username: fields.username,
            password: fields.password,
            avatar: filename
          });

          try {
            // 3.Move file
            yield fs.rename(fields.avatar.path, `${filepath}/${filename}`);

            // 4.Save user
            yield user.save();
          } catch (e) {
            // Remove temp file
            yield fs.unlink(fields.avatar.path);

            // User already exists
            if (e.code === 11000) {
              return res.status(400).json({
                username: {
                  msg: 'username already exists'
                }
              });
            } else {
              throw(e);
            }
          }

          // 5.Return token
          let token = createToken(user);

          return res.status(200).json({
            msg: 'user has been created',
            token: token
          });
        }
      }).catch(err => {
        return next(err);
      });
    });
  },

  /**
   * Login route
   * @param  {Object}   req
   * @param  {Object}   res
   * @param  {Function} next
   */
  login: (req, res, next) => {
    // Find a user
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
      } else if (req.body.password && user.checkPassword(req.body.password)) {
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
    });
  },

  /**
   * Return user's info
   * @param  {Object}   req
   * @param  {Object}   res
   * @param  {Function} next
   */
  me: (req, res, next) => {
    co(function*(){
      let user = yield User.findOne({
        _id: req.user._id
      }, {
        salt: 0,
        hashedPassword: 0
      });

      return res.status(200).json(user);
    }).catch(err => {
      console.log(err);
      return next(err);
    });
  }
};