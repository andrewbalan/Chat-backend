let co   = require('co');
let fs   = require('co-fs');
let User = require('models/user');
let Chat = require('models/chat');

const DIR = require('config').uploadDir;

/**
 * Clear DB and remove uploaded files
 * @param  {Function} done
 */
module.exports = function clear(done) {
  co(function* () {
    // Remove all collections
    yield [
      User.remove({}),
      Chat.remove({})
    ];

    // Remove all files
    let files = yield fs.readdir(DIR);

    for (file of files) {
      let filePath = `${DIR}/${file}`;
      yield fs.unlink(filePath);
    };

    return done();
  }).catch(done);
};