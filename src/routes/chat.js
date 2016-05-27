'use strict';

var co           = require('co');
var User         = require('models/user');
var Chat         = require('models/chat');
var mongoose     = require('mongoose');
var CannotDelete = require('exceptions/CannotDelete');

module.exports = {

  create: (req, res, next) => {
    req.assert('caption', '3 to 40 characters required').len(3, 40);
    req.assert('caption', 'field is required').notEmpty();

    let errors = req.validationErrors(true);
    if (errors) {
      res.status(400).json(errors);
    } else {
      let chat = new Chat({
        caption: req.body.caption,
        creator: req.user._id
      });

      chat.save((err, chat) => {
        if (err) return next(err);
        res.status(200).json({
          success: true,
          id: chat._id
        });
      });
    }
  },

  opened: (req, res, next) => {
    co(function*() {
      let chats = yield Chat.find({
        users: {
          $in : [req.user._id]
        }
      },{
        messages: 0
      });

      for(let i in chats)
        yield chats[i] 
          .populate('_creator', {'name': 1, 'username': 1})
          .execPopulate();

      return res.status(200).json(chats);
    }).catch(next);
  },

  available: (req, res, next) => {
    co(function*() {
      let chats = yield Chat.find({
        users: {
          $nin: [req.user._id]
        }
      }, {
        messages: 0
      });

      for(let i in chats)
        yield chats[i].populate('_creator', {'name': 1, 'username': 1}).execPopulate();

      return res.status(200).json(chats);
    }).catch(next);
  },

  join: (req, res, next) => {
    // cast id to the ObjectId
    let chatId = mongoose.Types.ObjectId(req.params.id);
    
    co(function*(){
      let chat = yield Chat.findOne({_id: chatId});

      if (!chat) return res.status(404).json({
        success: false,
        msg: 'chat not found'
      });

      yield chat.addUser(req.user._id);
      return res.status(200).json({
        success: true
      });
    }).catch(next);
  },

  leave: (req, res, next) => {
    // cast id to the ObjectId
    let chatId = mongoose.Types.ObjectId(req.params.id);
    
    co(function*(){
      let chat = yield Chat.findOne({_id: chatId});

      if (!chat) return res.status(404).json({
        success: false,
        msg: 'chat not found'
      });

      try {
        yield chat.removeUser(req.user._id);
      } catch(err) {
        if (err instanceof CannotDelete) {
          return res.status(400).json({
            success: false,
            msg: 'creator cannot leave chat'
          });
        } else {
          throw new Error(err);
        }
      }
      return res.status(200).json({
        success: true
      });
    }).catch(next);
  },

  delete: (req, res, next) => {
    // cast id to the ObjectId
    let chatId = mongoose.Types.ObjectId(req.params.id);
    
    co(function*(){
      let chat = yield Chat.findOne({
        _id: chatId,
        _creator: req.user._id
      });

      if (!chat) return res.status(404).json({
        success: false,
        msg: 'chat not found'
      });

      let pr = yield chat.remove();

      return res.status(200).json({
        success: true
      });
    }).catch(next);
  },
}