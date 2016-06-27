'use strict';

let User                   = require('models/user');
let Chat                   = require('models/chat');
let ObjectId               = require('mongoose').Types.ObjectId;
let co                     = require('co');
let cofs                   = require('co-fs');
let fs                     = require('fs');
let getValidationErrors    = require('lib/getValidationErrors');
let path                   = require('path');
let VolumeExceedError      = require('streams/limitedFileStream').VolumeExceedError;
let LimitedFileStream      = require('streams/limitedFileStream').LimitedFileStream;

const DIR            = require('config').uploadDir;
const NUMBER_OF_MSGS = require('config').numberOfMsgsToLoad;

/**
 * Error handler for co catch.
 * Expects a 'callback' in a lexical environment
 * @param  {Error} err
 */
function coErrorHandler(err) {
  console.error(err);
  return callback({
    success: false,
    msg: error.message || 'internal server error'
  });
}

module.exports = (socket, io, USER_ID) => {
  return {

    /**
     * Create new chat
     * @param  {String}   caption
     * @param  {Function} callback
     * @return callback invocation
    */
    create: function (stream, data, callback) {
      // 1. Validate input
      let validationRules = require('./validationRules').createChat;
      let errors = getValidationErrors(data, validationRules);

      if (errors) {
        return callback({
          success: false,
          errors: errors
        });
      }

      // 2. Copy file
      let extension = path.extname(data.avatar.name);
      let filename  = require('lib/generateRandomFilename')(extension);

      let fullpath  = `${DIR}/${filename}`;
      let maxFileSize = validationRules.avatar.size.value.max;

      stream.pipe(new LimitedFileStream(fullpath, maxFileSize))
      // Stream error handler
      .on('error', err => {
        if (err instanceof VolumeExceedError) {
          callback({
            success: false,
            errors: {
              avatar: validationRules.avatar.size.message
            }
          });
        }
        if (process.env.NODE_ENV !== 'test') console.error(err.message);
      })

      // 3. Save chat
      .on('finish', () => {
        co(function* () {
          // Save chat
          let chat = yield new Chat({
            caption: data.caption,
            creator: USER_ID,
            avatar: filename
          }).save();

          // Populate creator
          yield chat
            .populate('_creator', {'name': 1, 'username': 1})
            .execPopulate();

          // Join namespace
          socket.join(chat._id.toString());

          // Return to client
          let plainChat = chat.toObject();
          plainChat._id = chat._id.toString();
          plainChat._creator._id = chat._creator._id.toString();
          plainChat.users = chat.users.map(val => {
            return val.toString();
          });

          callback({
            success: true,
            chat: plainChat
          });

          // Broadcasting event
          socket.broadcast.emit('chat:created', plainChat);
        }).catch(coErrorHandler);
      });
    },

    /**
     * Delete chat
     * @param  {String}   id
     * @param  {Function} callback
     * @return callback invocation
    */
    delete: function (id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);

      co(function* () {
        // Find chat
        let chat = yield Chat.findOne({
          _id: CHAT_ID,
          _creator: USER_ID
        });

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        // Remove picture
        yield cofs.unlink(`${DIR}/${chat.avatar}`);

        // Delete chat
        yield chat.remove();

        callback({
          success: true
        });

        // Broadcasting event
        socket.broadcast.emit('chat:deleted', CHAT_ID);

      }).catch(coErrorHandler);
    },

    /**
     * Join chat
     * @param  {String}   id
     * @param  {Function} callback
     * @return callback invocation
    */
    join: function (id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);

      co(function* () {
        // Parallel execution
        let [chat, user] = yield [
          // Find a chat
          Chat.findOne({ _id: CHAT_ID }, {
            messages: 0,
            users: 0
          }),

          // Find a user
          User.findOne({ _id: USER_ID }, {
            name: 1,
            username: 1,
            avatar: 1
          })
        ];

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        // Add user
        yield chat.addUser(USER_ID);

        let [msgs] = yield [
          // Get messages
          chat.getMessages(
            null,
            null,
            NUMBER_OF_MSGS
          ),

          // Populate creator
          chat
            .populate('_creator', { 'name': 1, 'username': 1 })
            .execPopulate()
        ];

        chat.messages = msgs;
        socket.join(CHAT_ID);

        callback({
          success: true,
          chat: chat
        });

        // Broadcasting event
        socket.to(CHAT_ID).broadcast.emit('user:joined', {
          user: user,
          chat: CHAT_ID
        });

      }).catch(coErrorHandler);
    },

    /**
     * Leave chat
     * @param  {String}   id
     * @param  {Function} callback
     * @return callback invocation
    */
    leave: function (id, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(id);

      co(function* () {
        let chat = yield Chat.findOne({ _id: CHAT_ID });

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        // Find a user
        let user = yield User.findOne({ _id: USER_ID }, {
          name: 1,
          username: 1,
          avatar: 1
        });

        // Check if user is a creator of current chat
        if (USER_ID.equals(chat.creator)) return callback({
          success: false,
          msg: 'creator cannot leave chat'
        });

        yield chat.removeUser(USER_ID);

        // Broadcasting event
        socket.to(CHAT_ID).broadcast.emit('user:left', {
          user: user,
          chat: CHAT_ID
        });
        socket.leave(CHAT_ID);

        callback({
          success: true
        });
      }).catch(coErrorHandler);
    },

    /**
     * Post message
     * @param  {Object}   data
     * @param  {Function} callback
     * @return callback invocation
    */
    post: function (data, callback) {
      // Cast id to the ObjectId
      const CHAT_ID = ObjectId(data.id);

      co(function* () {
        // Find a chat
        let chat = yield Chat.findOne({ _id: CHAT_ID });

        if (!chat) return callback({
          success: false,
          msg: 'chat not found'
        });

        // Push there a message
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

      }).catch(coErrorHandler);
    }

  };
};