'use strict';

var SchemaType = require('../schematype');
var util = require('../util');
var ValidationError = require('../error/validation');

/**
 * String schema type.
 *
 * @class SchemaTypeString
 * @param {String} name
 * @param {Object} [options]
 *   @param {Boolean} [options.required=false]
 *   @param {String|Function} [options.default]
 * @constructor
 * @extends {SchemaType}
 * @module warehouse
 */
function SchemaTypeString(name, options){
  SchemaType.call(this, name, options);
}

util.inherits(SchemaTypeString, SchemaType);

/**
 * Casts a string.
 *
 * @method cast
 * @param {*} value
 * @param {Object} data
 * @return {String}
 */
SchemaTypeString.prototype.cast = function(value_, data){
  var value = SchemaType.prototype.cast.call(this, value_, data);

  if (value == null || typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
};

/**
 * Validates a string.
 *
 * @method validate
 * @param {*} value
 * @param {Object} data
 * @return {String|Error}
 */
SchemaTypeString.prototype.validate = function(value_, data){
  var value = SchemaType.prototype.validate.call(this, value_, data);
  if (value instanceof Error) return value;

  if (value !== undefined && typeof value !== 'string'){
    return new ValidationError('`' + value + '` is not a string!');
  }

  return value;
};

/**
 * Checks the equality of data.
 *
 * @method match
 * @param {*} value
 * @param {String|RegExp} query
 * @param {Object} data
 * @return {Boolean}
 */
SchemaTypeString.prototype.match = function(value, query, data){
  if (typeof query.test === 'function'){
    return query.test(value);
  } else {
    return value === query;
  }
};

module.exports = SchemaTypeString;