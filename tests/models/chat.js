'use strict';

let Chat     = require('models/chat');
let User     = require('models/user');
let chai     = require('chai');
let co       = require('co');
let testData = require('testdata/chat');
let clear    = require('clear');

let expect    = chai.expect;
let usersData = testData.users;
let chatsData = testData.chats;


module.exports = app => {
  describe('Chat model', () => {

    before(done => {
      co(function*() {
        yield User.remove({});
        yield Chat.remove({});

        yield new User(usersData[0]).save();
        done();
      }).catch(done);
    });

    after(clear);

    it('Should not create a chat without caption and owner', done => {
      let chat = new Chat({});
      chat.save(err => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.name).to.equal('ValidationError');

        done();
      });
    });

    it('Should create a new chat', done => {
      co(function*() {
        let user = yield User.findOne({});

        let chat = new Chat({
          caption: chatsData[0].caption,
          creator: user._id
        });

        yield chat.save();
        done();
      }).catch(done);
    });

    it('Array users should contain creator\'s id', (done) => {
      co(function*() {
        let user = yield User.findOne({username: usersData[0].username});
        let chat = yield Chat.findOne({caption: chatsData[0].caption});
        expect(chat.users).to.include.members([user._id]);
        done();
      }).catch(done);
    });

    it('Should has a correct link to user', (done) => {
      co(function*() {
        let user = yield User.findOne({username: usersData[0].username});
        let chat = yield Chat.findOne({caption: chatsData[0].caption});

        yield chat.populate('_creator').execPopulate();
        expect(chat.creator.username).to.equal(user.username);
        done();
      }).catch(done);
    });

    describe('addUser()', () => {
      before((done) => {
        co(function*(){
          yield new User(usersData[1]).save();
          done();
        }).catch(done);
      });

      it('Should add a user to user\'s array', done => {
        co(function*() {
          let user = yield User.findOne({username: usersData[1].username});
          let chat = yield Chat.findOne({caption: chatsData[0].caption});

          yield chat.addUser(user._id);

          chat = yield Chat.findOne({caption: chatsData[0].caption});
          expect(chat.users).to.have.lengthOf(2);
          expect(chat.users).to.include.members([user._id]);

          done();
        }).catch(done);
      });

      it('Should not add a user to user\'s array two times', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let user = yield User.findOne({username: usersData[1].username});

          yield chat.addUser(user._id);
          yield chat.addUser(user._id);

          chat = yield Chat.findOne({caption: chatsData[0].caption});
          expect(chat.users).to.have.lengthOf(2);

          done();
        }).catch(done);
      });
    });

    describe('removeUser()', () => {
      it('Should remove user from user\'s array', (done) => {
        co(function*(){
          let chat  = yield Chat.findOne({caption: chatsData[0].caption});
          let user1 = yield User.findOne({username: usersData[0].username});
          let user2 = yield User.findOne({username: usersData[1].username});

          yield chat.removeUser(user2._id);

          chat = yield Chat.findOne({caption: chatsData[0].caption});
          expect(chat.users).to.have.lengthOf(1);
          expect(chat.users).to.not.include.members([user2._id]);
          expect(chat.users).to.include.members([user1._id]);

          done();
        }).catch(done);
      });

      it('Shouldn\'t remove creator from user\'s array', (done) => {
        co(function*(){
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let user = yield User.findOne({username: usersData[0].username});

          try {
            yield chat.removeUser(user._id);
          } catch (err) {
            expect(err).to.be.an.instanceof(Error);
          }

          chat = yield Chat.findOne({caption: chatsData[0].caption});
          expect(chat.users).to.have.lengthOf(1);
          expect(chat.users).to.include.members([user._id]);

          done();
        }).catch(done);
      });
    });

    describe('postMessage()', () => {
      it('Should post a message from the user', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let user = yield User.findOne({username: usersData[1].username});

          yield chat.postMessage(user._id, chatsData[0].messages[0]);
          chat = yield Chat.findOne({caption: chatsData[0].caption});

          expect(user._id.equals(chat.messages[0]._sender)).to.equal(true);
          expect(chat.messages).to.have.lengthOf(1);
          expect(chat.messages[0].text).to.equal('Hello world');

          done();
        }).catch(done);
      });
    });

    describe('getMessages()', () => {
      let anyMessageId;
      let sender;

      before(done => {
        co(function*() {
          let user = yield User.findOne({username: usersData[0].username});
          let chat = yield Chat.findOne({caption: chatsData[0].caption});

          yield chat.postMessage(user._id, chatsData[0].messages[1]);
          yield chat.postMessage(user._id, chatsData[0].messages[2]);
          yield chat.postMessage(user._id, chatsData[0].messages[3]);
          yield chat.postMessage(user._id, chatsData[0].messages[4]);
          yield chat.postMessage(user._id, chatsData[0].messages[5]);

          chat         = yield Chat.findOne({caption: chatsData[0].caption});
          anyMessageId = chat.messages[3]._id;
          sender       = user;

          done();
        }).catch(done);
      });

      it('Should return 2 messages which older than certain id', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let msgs = yield chat.getMessages('lower', anyMessageId, 2);

          expect(msgs).to.be.an('array');
          expect(msgs).to.have.lengthOf(2);
          expect(msgs[0].text).to.equal(chatsData[0].messages[2]);
          expect(msgs[1].text).to.equal(chatsData[0].messages[1]);

          expect(msgs[1]._sender._id.toString()).to.equal(sender._id.toString());
          expect(msgs[1]._sender.name).to.equal(sender.name);

          done();
        }).catch(done);
      });

      it('Should return 1 message which newer than certain id', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let msgs = yield chat.getMessages('greater', anyMessageId, 1);

          expect(msgs).to.be.an('array');
          expect(msgs).to.have.lengthOf(1);
          expect(msgs[0].text).to.equal(chatsData[0].messages[4]);

          expect(msgs[0]._sender._id.toString()).to.equal(sender._id.toString());
          expect(msgs[0]._sender.name).to.equal(sender.name);

          done();
        }).catch(done);
      });

      it('Should return 6 last messages', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let msgs = yield chat.getMessages(null, null, 6);

          expect(msgs).to.have.lengthOf(6);
          expect(msgs[0].text).to.equal(chatsData[0].messages[0]);

          done();
        }).catch(done);
      });

      it('Should return 3 last messages', done => {
        co(function*() {
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let msgs = yield chat.getMessages(null, null, 3);

          expect(msgs).to.have.lengthOf(3);
          expect(msgs[0].text).to.equal(chatsData[0].messages[3]);
          expect(msgs[1].text).to.equal(chatsData[0].messages[4]);
          expect(msgs[2].text).to.equal(chatsData[0].messages[5]);

          done();
        }).catch(done);
      });

    });
  });
}