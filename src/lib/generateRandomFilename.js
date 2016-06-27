'use strict';

/**
 * Function returns a random name which
 * appended with forwarded extension
 * @param  {String} extension
 * @return {String}
 */
module.exports = function generateRandomFilename(extension) {
  let filename  = '';

  filename += Date.now().toString();
  filename += Math.ceil(Math.random()*100).toString();
  filename += extension;

  return filename;
};