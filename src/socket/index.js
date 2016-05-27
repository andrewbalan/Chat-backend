'use strict';

let socketio = require('socket.io');
let secret   = require('config').key;
let User     = require('models/user');
let Chat     = require('models/chat');
let co       = require('co');
let ObjectId = require('mongoose').Types.ObjectId;

const AMOUNT_OF_MSGS_TO_LOAD = 10;

module.exports = function(server) {
  let io = socketio(server);

  // Simple io error handler
  let ioErrorHandler = function(err) {
    console.error(err);
    return callback({
      success: false,
      error: 'internal server error'
    });
  };

  // Check token
  io.use(require('socketio-jwt').authorize({
    secret: secret,
    handshake: true
  }));


  // If token is valid then handling 'connection' event
  io.on('connection', function (socket) {
    
    // Cast to the ObjectID
    const USER_ID = new ObjectId(socket.decoded_token.id);
    
    let chat = require('./chat')(socket, io, USER_ID);

    // Common channel
    socket.on('chat:create', chat.create);

    socket.on('chat:delete', chat.delete);

    socket.on('chat:join', chat.join);

    socket.on('chat:leave', chat.leave);

    socket.on('chat:post', chat.post);

    co(function* () {

      /* Get opened chats */

      let openedChats = yield Chat.find({
        users: {
          $in : [USER_ID]
        }
      },{
        messages: 0,
        users: 0
      });

      for(let i in openedChats)
        yield openedChats[i] 
          .populate('_creator', {'name': 1, 'username': 1})
          .execPopulate();

      // Load N last messages for each opened chat
      for(let i in openedChats) {
        let msgs = yield openedChats[i]
          .getMessages(null, null, AMOUNT_OF_MSGS_TO_LOAD);

        openedChats[i].messages = msgs;
      }

      // Join to the appropriate rooms in io
      for(let i in openedChats)
        socket.join(openedChats[i]._id.toString());


      /* Get available chats */

      let availableChats = yield Chat.find({
        users: {
          $nin: [USER_ID]
        }
      }, {
        messages: 0
      });

      for(let i in availableChats)
        yield availableChats[i]
          .populate('_creator', {'name': 1, 'username': 1})
          .execPopulate();


      /* Broadcasting event */

      socket.emit('subscribed', {
        opened: openedChats,
        available: availableChats
      });

    }).catch(err => {
      console.error(err);
      throw err;
    });

  });
}