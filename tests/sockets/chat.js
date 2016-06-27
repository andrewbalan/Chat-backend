'use strict';

let chai            = require('chai');
let fs              = require('fs');
let co              = require('co');
let path            = require('path');
let io              = require('socket.io-client');
let ss              = require('socket.io-stream');
let User            = require('models/user');
let Chat            = require('models/chat');
let createToken     = require('lib/createToken');
let testData        = require('testdata/chat');
let validationRules = require('socket/validationRules').createChat;
let clear           = require('clear');


const URL     = 'http://localhost:' + require('config').port;
let expect    = chai.expect;
let usersData = testData.users;
let chatsData = testData.chats;

let users  = [];
let tokens = [];
let chats  = [];

/**
 * Return object which contain params for
 * io connection, token are got from 'tokens' array
 * @param  {Number} userIndex Index of user
 * @return {Object}           Object with params
 */
function getOptions(userIndex = 0) {
  return {
    transports: ['websocket'],
    forceNew: true,
    query: `token=${tokens[userIndex]}`,
  };
}

module.exports = app => {
  describe('Socket', () => {

    before(done => {
      co(function*(){
        // Remove all collections
        yield [
          User.remove({}),
          Chat.remove({})
        ];

        let promises = [];
        for (let user of usersData) {
          promises.push(new User(user).save());
        }
        // Save users
        users = yield promises;

        // Generate tokens
        tokens = users.map(user => {
          return createToken(user);
        });

        // Save chat
        let chat = yield new Chat({
          caption: chatsData[1].caption,
          creator: users[1]._id
        }).save();

        // For sake of convenience save
        // this value to array of chats
        chats[1] = chat;

        return done();
      }).catch(done);
    });

    after(clear);

    it('Should do not connect without token', done => {
      let client = io.connect(URL, {
        transports: ['websocket'],
        forceNew: true
      });

      client.once("error", function(error) {
        if (error.type == "UnauthorizedError" || error.code == "invalid_token") {
          client.disconnect();
          done();
        }
      });
    });

    it('Server should emit \'subscribed\' event after connection', done => {
      let client = io.connect(URL, getOptions());

      client.once('connect', () => {
        client.once('subscribed', data => {
          expect(data.opened).to.be.an('array');
          expect(data.available).to.be.an('array');

          client.disconnect();
          done();
        });
      });
    });

    describe('Create chat', () => {
      it('Should return error messages : \'cannot be empty\'', done => {
        let client = io.connect(URL, getOptions());

        client.once('subscribed', () => {
          ss(client).emit('chat:create', null, {}, data => {
            expect(data.success).to.equal(false);
            expect(data.errors.caption).to.equal('cannot be empty');
            expect(data.errors.avatar).to.equal('cannot be empty');

            client.disconnect();
            done();
          });
        });
      });

      it('Should return error message based on the length rule', done => {
        let client = io.connect(URL, getOptions());
        let data = {caption: 'aa'};

        client.once('subscribed', () => {
          ss(client).emit('chat:create', null, data, result => {
            expect(result.success).to.equal(false);
            expect(result.errors.avatar).to.equal('cannot be empty');
            expect(result.errors.caption)
              .to.equal(validationRules.caption.length.message);

            client.disconnect();
            done();
          });
        });
      });

      it('Should return error based on file type rule', done => {
        let client   = io.connect(URL, getOptions());
        var stream   = ss.createStream();
        var filename = 'tests/testdata/wrongType.bin';
        let data     = {
          caption: chatsData[0].caption,
          avatar: {
            name: path.basename(filename)
          }
        };

        client.once('subscribed', () => {
          ss(client).emit('chat:create', stream, data, result => {
            expect(result.errors.avatar)
              .to.equal(validationRules.avatar.extension.message);
            client.disconnect();
            done();
          });
        });

        fs.createReadStream(filename).pipe(stream);
      });

      it('Should return error based on file length rule', done => {
        let client   = io.connect(URL, getOptions());
        var stream   = ss.createStream();
        var filename = 'tests/testdata/bigImage.jpg';

        let data = {
          caption: chatsData[0].caption,
          avatar: {
            name: path.basename(filename)
          }
        };

        client.once('subscribed', () => {
          ss(client).emit('chat:create', stream, data, result => {
            expect(result.errors.avatar)
              .to.equal(validationRules.avatar.size.message);
            client.disconnect();
            done();
          });
        });

        fs.createReadStream(filename).pipe(stream);
      });

      it('Should create a new chat and broadcast event', done => {
        let clientOfCreator   = io.connect(URL, getOptions(0));
        var stream   = ss.createStream();
        var filename = 'tests/testdata/validChatAvatar.png';

        let data = {
          caption: chatsData[0].caption,
          avatar: {
            name: path.basename(filename)
          }
        };

        clientOfCreator.once('subscribed', () => {
          let clientOfListener = io.connect(URL, getOptions(1));

          clientOfListener.once('subscribed', () => {
            ss(clientOfCreator).emit('chat:create', stream, data, result => {
              expect(result.success).to.equal(true);
              expect(result.chat.caption).to.equal(chatsData[0].caption);
              expect(result.chat._creator._id).to.equal(users[0]._id.toString());
              expect(result.chat._creator.name).to.equal(users[0].name);
              expect(result.chat.users).to.contain(users[0]._id.toString());

              // For sake of convenience save
              // this value to array of chats
              chats[0] = result.chat;
            });

            clientOfListener.once('chat:created', result => {
              expect(result.caption).to.equal(chatsData[0].caption);
              expect(result._creator._id).to.equal(users[0]._id.toString());
              expect(result._creator.name).to.equal(users[0].name);
              expect(result.users).to.contain(users[0]._id.toString());

              clientOfCreator.disconnect();
              clientOfListener.disconnect();
              done();
            });
          });
        });

        fs.createReadStream(filename).pipe(stream);
      });
    });

    describe('Join chat', () => {
      it('Should return an error message: \'chat not found\'', done => {
        let client = io.connect(URL, getOptions());

        client.once('subscribed', () => {
          client.emit('chat:join', 'rubbish48464', data => {
            expect(data.success).to.equal(false);
            expect(data.msg).to.equal('chat not found');

            client.disconnect();
            done();
          });
        });
      });

      it('Should join chat and broadcast event', done => {
        // User0 join the chat of User1
        let firstClient = io.connect(URL, getOptions(0));

        firstClient.once('subscribed', () => {
          let secondClient = io.connect(URL, getOptions(1));

          secondClient.once('subscribed', () => {
            firstClient.emit('chat:join', chats[1]._id, data => {
              expect(data.success).to.equal(true);
              expect(data.chat._creator.name).to.equal(users[1].name);
              expect(data.chat._id).to.equal(chats[1]._id.toString());
            });

            secondClient.once('user:joined', data => {
              expect(data.user.name).to.equal(users[0].name);
              expect(data.chat).to.equal(chats[1]._id.toString());
              firstClient.disconnect();
              secondClient.disconnect();
              done();
            });
          });
        });
      });
    });

    describe('Leave chat', () => {
      it('Should return an error message: \'chat not found\'', done => {
        let client = io.connect(URL, getOptions());

        client.once('subscribed', () => {
          client.emit('chat:leave', 'rubbish48464', data => {
            expect(data.success).to.equal(false);
            expect(data.msg).to.equal('chat not found');

            client.disconnect();
            done();
          });
        });
      });

      it('Should leave chat and broadcast event', done => {
        // User0 leave the chat of User1
        let firstClient = io.connect(URL, getOptions(0));

        firstClient.once('subscribed', () => {
          let secondClient = io.connect(URL, getOptions(1));

          secondClient.once('subscribed', () => {
            firstClient.emit('chat:leave', chats[1]._id, data => {
              expect(data.success).to.equal(true);
            });

            secondClient.once('user:left', data => {
              expect(data.user.name).to.equal(users[0].name);
              expect(data.chat).to.equal(chats[1]._id.toString());
              firstClient.disconnect();
              secondClient.disconnect();
              done();
            });
          });
        });
      });
    });

    describe('Post message', () => {
      before(done => {
        co(function*(){
          // Create new chat
          chats[2] = yield new Chat({
            caption: chatsData[2].caption,
            creator: users[0]._id
          }).save();

          // Push there a user
          yield chats[2].addUser(users[2]._id);
          done();
        }).catch(done);
      });

      it('Should return an error message: \'chat not found\'', done => {
        let client = io.connect(URL, getOptions());

        client.once('subscribed', () => {
          client.emit('chat:post', {
            id: 'rubbish48464',
            text: chatsData[2].messages[0]
          }, data => {
            expect(data.success).to.equal(false);
            expect(data.msg).to.equal('chat not found');

            client.disconnect();
            done();
          });
        });
      });

      it('Should post a message and broadcast event', done => {
        // User0 posts a message
        // User2 listens for event of message
        let clientOfSender = io.connect(URL, getOptions(0));

        clientOfSender.once('subscribed', () => {
          let clientOfListener = io.connect(URL, getOptions(2));
          let messageId;

          clientOfListener.once('subscribed', () => {
            clientOfSender.emit('chat:post', {
              id: chats[2]._id,
              text: chatsData[2].messages[0]
            }, data => {
              expect(data.success).to.equal(true);
              expect(data.message.text).to.equal(chatsData[2].messages[0]);
              expect(data.message._sender.name)
                .to.equal(users[0].name);
              messageId = data.message._id;
            });

            clientOfListener.once('message:posted', data => {
              expect(data.message._id).to.equal(messageId);
              expect(data.message.text).to.equal(chatsData[2].messages[0]);
              expect(data.id).to.equal(chats[2]._id.toString());
              expect(data.message._sender.name)
                .to.equal(users[0].name);
              clientOfSender.disconnect();
              clientOfListener.disconnect();
              done();
            });
          });
        });
      });
    });

    describe('Delete chat', () => {
      it('Should return an error message: \'chat not found\'', done => {
        let client = io.connect(URL, getOptions());

        client.once('subscribed', () => {
          client.emit('chat:delete', 'rubbish48464', data => {
            expect(data.success).to.equal(false);
            expect(data.msg).to.equal('chat not found');

            client.disconnect();
            done();
          });
        });
      });

      it('Should not delete if user is not a creator of curent chat', done => {
        let client = io.connect(URL, getOptions(1));

        client.once('subscribed', () => {
          client.emit('chat:delete', chats[0]._id, data => {
            expect(data.success).to.equal(false);
            expect(data.msg).to.equal('chat not found');

            client.disconnect();
            done();
          });
        });
      });

      it('Should remove chat and broadcast event', done => {
        // User0 remove his chat
        // User2 listens for event of message
        let clientOfSender = io.connect(URL, getOptions(0));

        clientOfSender.once('subscribed', () => {
          let clientOfListener = io.connect(URL, getOptions(2));

          clientOfListener.once('subscribed', () => {
            clientOfSender.emit('chat:delete', chats[0]._id, data => {
              expect(data.success).to.equal(true);
            });

            clientOfListener.once('chat:deleted', data => {
              expect(data).to.equal(chats[0]._id.toString());

              clientOfSender.disconnect();
              clientOfListener.disconnect();
              done();
            });
          });
        });
      });
    });

  });
};