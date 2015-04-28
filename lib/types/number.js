'use strict';

var SchemaType = require('../schematype');
var util = require('../util');
var ValidationError = require('../error/validation');

/**
 * Number schema type.
 *
 * @class SchemaTypeNumber
 * @param {String} name
 * @param {Object} options
 *   @param {Boolean} [options.required=false]
 *   @param {Number|Function} [options.default]
 * @constructor
 * @extends {SchemaType}
 * @module warehouse
 */
function SchemaTypeNumber(name, options){
  SchemaType.call(this, name, options);
}

util.inherits(SchemaTypeNumber, SchemaType);

/**
 * Casts a number.
 *
 * @method cast
 * @param {*} value
 * @param {Object} data
 * @return {Number}
 */
SchemaTypeNumber.prototype.cast = function(value_, data){
  var value = SchemaType.prototype.cast.call(this, value_, data);

  if (value == null || typeof value === 'number') return value;

  return +value;
};

/**
 * Validates a number.
 *
 * @method validate
 * @param {*} value
 * @param {Object} data
 * @return {Number|Error}
 */
SchemaTypeNumber.prototype.validate = function(value_, data){
  var value = SchemaType.prototype.validate.call(this, value_, data);
  if (value instanceof Error) return value;

  if (value !== undefined && (typeof value !== 'number' || isNaN(value))){
    return new ValidationError('`' + value + '` is not a number!');
  }

  return value;
};

module.exports = SchemaTypeNumber;