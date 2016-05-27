'use strict';

let User        = require('models/user');
let Chat        = require('models/chat');
let createToken = require('lib/createToken');
let chai        = require('chai');
let co          = require('co');
let request     = require('supertest');
let testData    = require('../test_data');

let expect    = chai.expect;
let usersData = testData.users;
let chatsData = testData.chats;

let user1, user2, user3;
let user1Token, user2Token, user3Token;

function init(done) {
  co(function*() {
    yield User.remove({});
    yield Chat.remove({});

    user1 = yield new User(usersData[0]).save();
    user2 = yield new User(usersData[1]).save();
    user3 = yield new User(usersData[2]).save();
    
    user1Token = createToken(user1);
    user2Token = createToken(user2);
    user3Token = createToken(user3);

    let chat1 = yield new Chat({
      caption: chatsData[0].caption,
      creator: user1._id
    }).save();

    let chat2 = yield new Chat({
      caption: chatsData[1].caption,
      creator: user1._id
    }).save();

    yield chat2.addUser(user2._id);

    let chat3 = yield new Chat({
      caption: chatsData[2].caption,
      creator: user2._id
    }).save();

    done();
  }).catch(done);
}

module.exports = app => {
  describe('Chat API', () => {

    describe('Create a new chat', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .post('/api/chat')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return error message : \'field is required\'', done => {
        request(app)
          .post('/api/chat')
          .send({
            caption: ''
          })
          .set('x-access-token', user1Token)
          .expect(400)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.caption.msg).to.equal('field is required');
            done(err);
          });
      });

      it('Should return error message : \'3 to 40 characters required\'', done => {
        request(app)
          .post('/api/chat')
          .send({
            caption: 'qq'
          })
          .set('x-access-token', user1Token)
          .expect(400)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.caption.msg).to.equal('3 to 40 characters required');
            done(err);
          });
      });

      it('Create a new chat', done => {
        request(app)
          .post('/api/chat')
          .send({
            caption: chatsData[0].caption
          })
          .set('x-access-token', user1Token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.success).to.equal(true);
            done(err);
          });
      });
    });

    describe('Return opened', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .get('/api/chat/opened')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return populated creator field', done => {
        co(function*(){
          request(app)
            .get('/api/chat/opened')
            .set('x-access-token', user1Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              expect(res.body).to.be.an('array');

              res.body.forEach((chat) => {
                expect(chat._creator.username).to.equal(user1.username);
              });
              done(err);
            });
        }).catch(done);
      });

      it('Should return user1\'s opened chats', done => {
        co(function*(){
          request(app)
            .get('/api/chat/opened')
            .set('x-access-token', user1Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              expect(res.body).to.be.an('array');
              expect(res.body).to.have.lengthOf(2);

              res.body.forEach((chat) => {
                expect(chat.users).to.include(user1._id.toString());
              });
              done(err);
            });
        }).catch(done);
      });

      it('Should return user2\'s opened chats', done => {
        request(app)
          .get('/api/chat/opened')
          .set('x-access-token', user2Token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body).to.be.an('array');
            expect(res.body).to.have.lengthOf(2);
            res.body.forEach((chat) => {
              expect(chat.users).to.include(user2._id.toString());
            });
            done(err);
          });
      });

      it('Should return user3\'s opened chats', done => {
        request(app)
          .get('/api/chat/opened')
          .set('x-access-token', user3Token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body).to.be.an('array');
            expect(res.body).to.have.lengthOf(0);
            done(err);
          });
      });
    });

    describe('Return available', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .get('/api/chat/available')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return user1\'s available chats', done => {
        co(function*(){
          request(app)
            .get('/api/chat/available')
            .set('x-access-token', user1Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              expect(res.body).to.be.an('array');
              expect(res.body).to.have.lengthOf(1);
              done(err);
            });
        }).catch(done);
      });

      it('Should return user2\'s available chats', done => {
        request(app)
          .get('/api/chat/available')
          .set('x-access-token', user2Token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body).to.be.an('array');
            expect(res.body).to.have.lengthOf(1);
            done(err);
          });
      });

      it('Should return user3\'s available chats', done => {
        request(app)
          .get('/api/chat/available')
          .set('x-access-token', user3Token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body).to.be.an('array');
            expect(res.body).to.have.lengthOf(3);
            done(err);
          });
      });
    });

    describe('Join chat', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .put('/api/chat/join/rubbish48464')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return an error message: \'chat not found\'', done => {
        request(app)
          .put('/api/chat/join/rubbish48464')
          .set('x-access-token', user1Token)
          .expect(404)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('chat not found');
            done(err);
          });
      });

      it('Should return: \'success: true\'', done => {
        co(function*(){
          let chat = yield Chat.findOne({caption: chatsData[0].caption});
          let chatId = chat._id.toString();
          
          request(app)
            .put('/api/chat/join/' + chatId)
            .set('x-access-token', user1Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              expect(res.body.success).to.equal(true);
              done(err);
            });
        }).catch(done);
      });
    });

    describe('Leave chat', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .put('/api/chat/leave/rubbish48464')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return an error message: \'chat not found\'', done => {
        request(app)
          .put('/api/chat/leave/rubbish48464')
          .set('x-access-token', user2Token)
          .expect(404)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('chat not found');
            done(err);
          });
      });

      it('Should return: \'success: true\'', done => {
        co(function*(){
          let chat = yield Chat.findOne({caption: chatsData[1].caption});
          let chatId = chat._id.toString();
          
          request(app)
            .put('/api/chat/leave/' + chatId)
            .set('x-access-token', user2Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              expect(res.body.success).to.equal(true);
              done(err);
            });
        }).catch(done);
      });
    });

    describe('Delete chat', () => {
      before(init);

      it('Should return an error message: \'no token provided\'', done => {
        request(app)
          .delete('/api/chat/rubbish48464')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return an error message: \'chat not found\'', done => {
        request(app)
          .delete('/api/chat/rubbish48464')
          .set('x-access-token', user1Token)
          .expect(404)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('chat not found');
            done(err);
          });
      });

      it('Should return: \'success: true\'', done => {
        co(function*(){
          let chat = yield Chat.findOne({caption: chatsData[1].caption});
          let chatId = chat._id.toString();
          
          request(app)
            .delete('/api/chat/' + chatId)
            .set('x-access-token', user1Token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              if (err) return done(err);
              expect(res.body.success).to.equal(true);

              Chat.findOne({caption: chatsData[1].caption}, (err, res) => {
                if (err) return done(err);
                expect(res).to.equal(null);
                done();
              });
            });
        }).catch(done);
      });
    });

  });
}