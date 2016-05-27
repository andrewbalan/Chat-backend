'use strict';

let CannotDelete = require('exceptions/CannotDelete');
let User         = require('models/user');
let Chat         = require('models/chat');
let ObjectId     = require('mongoose').Types.ObjectId;
let co           = require('co');

module.exports = function(socket, io, USER_ID) {
  return {

    create: function(caption, callback) {
      if (!caption) {
        return callback({
          success: false,
          msg: 'this field is required'
        });
      }

      if (caption.length < 3 || caption.length > 40) {
        return callback({
          success: false,
          msg: '3 to 40 characters is required'
        });
      }

      co(function*() {
        let chat = yield new Chat({
          caption: caption,
          creator: USER_ID
        }).save();

        yield chat
          .populate('_creator', {'name': 1, 'username': 1})
          .execPopulate();

        callback({
          success: true,
          chat: chat
        });

        // Broadcasting event
        socket.broadcast.emit('chat:created', chat);

      }).catch(err => {
        console.error(err);
        return callback({
          success: false,
          msg: 'internal server error'
        });
      });
    },


    delete: function(id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);

      co(function*(){
        let chat = yield Chat.findOne({
          _id: CHAT_ID,
          _creator: USER_ID
        });

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        let pr = yield chat.remove();

        // Broadcasting event
        socket.broadcast.emit('chat:deleted', CHAT_ID);

        callback({
          success: true
        });

      }).catch(err => {
        console.error(err);
        callback({
          success: false,
          msg: 'internal server error'
        });
      });
    },


    join: function (id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);
      
      co(function*(){
        let chat = yield Chat.findOne({_id: CHAT_ID}, {
          messages: 0,
          users: 0
        });

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        let user = yield User.findOne({_id: USER_ID}, {
          name:1,
          username:1
        });

        yield chat.addUser(USER_ID);

        /**
          TODO:
          - push to chat 10 last messagess
         */
        
        yield chat
          .populate('_creator', {'name': 1, 'username': 1})
          .execPopulate();

        callback({
          success: true,
          chat: chat
        });

        // Broadcasting event
        socket.join(CHAT_ID);
        socket.to(CHAT_ID).broadcast.emit('user:joined', user);

      }).catch(err => {
        console.error(err);
        callback({
          success: false,
          msg: 'internal server error'
        });
      });
    },


    leave: function (id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);
      
      co(function*(){
        let chat = yield Chat.findOne({_id: CHAT_ID});

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        try {
          yield chat.removeUser(USER_ID);
        } catch(err) {
          console.error(err);

          if (err instanceof CannotDelete) return callback({
            success: false,
            msg: 'creator cannot leave chat'
          });

          return callback({
            success: false,
            msg: 'internal server error'
          });
        }

        callback({
          success: true
        });

        // Broadcasting event
        socket.leave(CHAT_ID);
        io.to(CHAT_ID).broadcast.emit('user:left', user);

      }).catch(err => {
        console.error(err);
        callback({
          success: false,
          msg: 'internal server error'
        });
      });
    },

    post : function (data, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(data.id);

      co(function*(){
        let chat = yield Chat.findOne({_id: CHAT_ID});

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        let message = yield chat.postMessage(USER_ID, data.text);

        callback({
          success: true,
          message: message
        });

        // Broadcasting event
        socket.to(data.id).broadcast.emit('message:posted', {
          id: data.id,
          message: message
        });

      }).catch(err => {
        console.error(err);
        callback({
          success: false,
          msg: 'internal server error'
        });
      });
    }

  }
}