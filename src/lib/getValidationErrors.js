'use strict';

let validator = require('validator');
let path      = require('path');

/**
 * Function checks whether the object or array is empty
 * @param  {Object|Array} obj
 * @return {Boolean}
 */
function isEmpty(obj) {
  return Object.keys(obj).length === 0 &&
    (obj.constructor === Object || obj.constructor === Array);
}

/**
 * Function gets array of fields and array of
 * validation rules and then it makes checking
 * on the basis of validation rules.
 * @param  {Array} fields
 * @param  {Array} rules
 * @return {Object|null}
 */
module.exports = function getValidationErrors(fields, rules) {
  let errors = {};

  // Iterate over all given fields
  for (let fieldName in rules) {

    let field = fields[fieldName];

    // Check whether the field exists
    if (!field || isEmpty(field)) {
      // Push message and go to the next iteration
      errors[fieldName] = 'cannot be empty';
      continue;
    }

    switch (rules[fieldName].type) {
      case 'String':
        // Iterate over all rules which are given for the current field
        for (let ruleName in rules[fieldName]) {
          if (ruleName === 'type') continue;

          switch (ruleName) {
            case 'length':
              // Check length
              if (!validator.isLength(field, {
                min: rules[fieldName][ruleName].value.min,
                max: rules[fieldName][ruleName].value.max
              })) {
                // Push message and go to the next iteration
                errors[fieldName] = rules[fieldName][ruleName].message;
                continue;
              }
              break;

            case 'locale':
              // Iterate over all forwarded locales
              let flags = rules[fieldName][ruleName].value.map(locale => {
                return validator.isAlphanumeric(field, locale);
              });

              let everyFlagIsTrue = flags.every(flag => { return flag; });

              if (!everyFlagIsTrue) {
                // Push message and go to the next iteration
                errors[fieldName] = rules[fieldName][ruleName].message;
                continue;
              }
              break;
          }
        }
        break;

      case 'File':
        // Iterate over all rules which are given for the current field
        for (let ruleName in rules[fieldName]) {
          if (ruleName === 'type') continue;
          switch (ruleName) {
            case 'extension':
              // Get file extension
              let extension = path.extname(field.name);

              // If file extension is not in the list
              // of extensions then push error
              if (rules[fieldName][ruleName].value.indexOf(extension) === -1) {
                // Push message and go to the next iteration
                errors[fieldName] = rules[fieldName][ruleName].message;
                continue;
              }
              break;

            case 'size':
              // Translate file size to kilobytes
              let size = field.size / 1000;

              if (size > rules[fieldName][ruleName].value.max) {
                // Push message and go to the next iteration
                errors[fieldName] = rules[fieldName][ruleName].message;
                continue;
              }
              break;
          }
        }
        break;
    }
  }

  return Object.keys(errors).length === 0 ? null : errors;
};