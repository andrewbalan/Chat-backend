'use strict';

let mongoose     = require('mongoose');
let co           = require('co');
let CannotDelete = require('exceptions/cannotDeleteException');
let Schema       = mongoose.Schema;

let chatSchema = new Schema({
  caption: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: 'default.png'
  },
  _creator: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  users: {
    type: Array
  },
  messages: [{
    text: {
      type: String,
      required: true
    },
    _sender: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    created: {
      type: Date,
      default: Date.now
    }
  }]
});

/**
 * Push user to 'users' array
 * @param  {ObjectId} userId
 * @return {Promise}
 */
chatSchema.methods.addUser = function(userId) {
  return new Promise((resolve, reject) => {
    this.update({
        $addToSet: {
          users: userId
        }
      },
      (err, res) => {
        if (err) reject(err);
        resolve(res);
      }
    );
  });
};

/**
 * Pull user from 'users' array
 * @param  {ObjectId} userId
 * @return {Promise}
 */
chatSchema.methods.removeUser = function(userId) {
  return new Promise((resolve, reject) => {
    if (this._creator.equals(userId)) {
      return reject(
        new CannotDelete('trying to remove creator from users')
      );
    }
    this.update({
        $pull: {
          users: userId
        }
      },
      (err, res) => {
        if (err) reject(err);
        resolve(res);
      }
    );
  });
};

/**
 * Push new message to 'messages' array
 * @param  {ObjectId} senderId
 * @param  {String} text
 * @return {Promise}
 */
chatSchema.methods.postMessage = function(senderId, text) {
  return new Promise((resolve, reject) => {
    this.messages.push({
      text: text,
      _sender: senderId
    });

    let self = this;
    let id = this.messages[this.messages.length-1]._id;

    co(function*(){
      let chat = yield self.save();

      // Find a created message when collection is updated
      for(let i in chat.messages) {
        if (chat.messages[i]._id === id) {
          var result = chat.messages[i];
          break;
        }
      }

      // Populate sender
      let populationParams = {
        path: '_sender',
        model: 'User',
        select: {
          name: 1,
          username: 1,
          avatar: 1
        }
      };
      yield self.model('Chat').populate(result, populationParams);

      resolve(result);
    }).catch(reject);
  });
};

/**
 * Return array of messages.
 * Possible usage:
 *   "getMessages('lower', msgId, 2)" - return 2 message which older
 *     msgId (instead of 'lower' could be 'greater')
 *   "getMessages(null, null, 5)" - return 5 latest messages
 *
 * @param  {null | String: 'lower' or 'greater'} operator
 * @param  {ObjectId} messageId
 * @param  {Number} count
 * @return {Promise}
 */
chatSchema.methods.getMessages = function(operator, messageId, count) {
  let params = [];

  params.push({
    $match: {
      _id: this._id
    }
  });

  params.push({
    $unwind: '$messages'
  });

  params.push({
    $project: {
      _id: "$messages._id",
      text: "$messages.text",
      _sender: "$messages._sender",
      created: "$messages.created"
    }
  });

  if(operator !== null && messageId !== null) {
    let sign;

    if (operator === 'lower') {
      sign = "$lt";
    } else if (operator === 'greater') {
      sign = "$gt";
    } else {
      throw new Error(`Operator is wrong: ${operator}`);
    }

    params.push({
      $match: {
        "_id": {
          [sign]: messageId
        }
      }
    });

    params.push({
      $sort: {
        "_id": operator === 'lower'? -1 : 1,
      }
    });

    if (typeof count === 'number') {
      params.push({
        $limit: count
      });
    }
  } else {
    params.push({
      $sort: {
        "_id": -1,
      }
    });

    if (typeof count === 'number') {
      params.push({
        $limit: count
      });
    }

    params.push({
      $sort: {
        "_id": 1,
      }
    });
  }

  return new Promise((resolve, reject) => {
    let self = this;

    co(function*(){
      let msgs = yield self.model('Chat').aggregate(params).exec();

      // Get name and username for each sender of message
      let populationParams = {
        path: '_sender',
        model: 'User',
        select: {
          name: 1,
          username: 1,
          avatar: 1
        }
      };

      yield self.model('Chat').populate(msgs, populationParams);

      resolve(msgs);
    }).catch(reject);
  });
};

chatSchema.virtual('creator')
  .set(function (creator) {
    this._creator = creator;

    // Push only unique elements
    if (this.users.indexOf(creator) == -1) {
      this.users.push(creator);
    }
  })
  .get(function () {
    return this._creator;
  });


module.exports = mongoose.model('Chat', chatSchema);