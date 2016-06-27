'use strict';

let fs       = require('fs');
let Writable = require('stream').Writable;

/**
 * Function returns true if argument is numeric
 * and false otherwise
 * @param   {any} n
 * @returns {Boolean}
 */
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * LimitedFileStream is designed to provide writing to filesystem
 * with restriction on total size of written data
 */

class LimitedFileStream extends Writable {
  constructor(filename, limit, options) {
    // Calls the stream.Writable() constructor
    super(options);

    this.total    = 0;
    this.filename = filename;
    this.limit    = limit * 1024;
    if (! isNumeric(this.limit) ) throw new Error('Limit is not numeric');
  }

  _write(chunk, encoding, callback) {
    if (this.total > this.limit) {
      // Remove underloaded file
      fs.unlink(this.filename, err => {
        if (err) callback(err);

        // Emit error
        callback(new VolumeExceedError('Stream exceeds allowed volume'));
      });
    } else {
      this.total += chunk.length;
      fs.appendFile(this.filename, chunk, callback);
    }
  }
}

class VolumeExceedError extends Error {
  constructor(message) {
    super(message);
  }
};

module.exports.LimitedFileStream = LimitedFileStream;
module.exports.VolumeExceedError = VolumeExceedError;