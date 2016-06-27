'use strict';


let co       = require('co');
let socketio = require('socket.io');
let secret   = require('config').key;
let User     = require('models/user');
let Chat     = require('models/chat');
var ss       = require('socket.io-stream');
let ObjectId = require('mongoose').Types.ObjectId;

const NUMBER_OF_MSGS = require('config').numberOfMsgsToLoad;

/**
 * Function is used for getting array with
 * yieldable items for populating those creators
 *
 * @param  {array} chats
 * @return {array}
 */
function populateCreator(chats) {
  let promises = [];

  for(let i in chats) {
    let yieldable = chats[i]
      .populate('_creator', {'name': 1, 'username': 1, 'avatar': 1})
      .execPopulate();

    promises.push(yieldable);
  }

  return promises;
}

/**
 * Function is used for getting array with
 * yieldable items for getting last messages
 * of passed chats
 * @param  {array} chats
 * @return {array}
 */
function loadLastMessages(chats) {
  let promises = [];

  for(let i in chats) {
    let yieldable = chats[i]
      .getMessages(null, null, NUMBER_OF_MSGS);

    promises.push(yieldable);
  }

  return promises;
}


module.exports = server => {
  let io = socketio(server);

  // Check token
  io.use(require('socketio-jwt').authorize({
    secret: secret,
    handshake: true
  }));


  // If token is valid then handling 'connection' event
  io.on('connection', socket => {

    // Cast to the ObjectID
    const USER_ID = new ObjectId(socket.decoded_token.id);

    let chat = require('./chat')(socket, io, USER_ID);

    // Subscribe on events

    // "ss(socket)" is used for getting opportunity of
    // applying streams through sockets
    ss(socket).on('chat:create', chat.create);

    socket.on('chat:delete', chat.delete);

    socket.on('chat:join', chat.join);

    socket.on('chat:leave', chat.leave);

    socket.on('chat:post', chat.post);

    // Get data and respond client to
    co(function* () {

      // 1.Get all the opened chats of the user
      let openedChats = yield Chat.find({
        users: {
          $in : [USER_ID]
        }
      },{
        messages: 0,
        users: 0
      });

      // Populate creators
      yield populateCreator(openedChats);

      // Load N last messages for each opened chat
      let msgs = yield loadLastMessages(openedChats);

      for(let i in openedChats)
        openedChats[i].messages = msgs[i];

      // Join the appropriate namespaces
      for(let i in openedChats)
        socket.join(openedChats[i]._id.toString());


      // 2.Get all the available chats of the user
      let availableChats = yield Chat.find({
        users: {
          $nin: [USER_ID]
        }
      }, {
        messages: 0
      });

      // Populate creators
      yield populateCreator(availableChats);

      // 3.Respond to client
      socket.emit('subscribed', {
        opened: openedChats,
        available: availableChats
      });

    }).catch(err => {
      console.error(err);
    });

  });
};