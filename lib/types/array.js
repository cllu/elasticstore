'use strict';

var SchemaType = require('../schematype');
var util = require('../util');
var _ = require('lodash');
var ValidationError = require('../error/validation');

var extend = util.extend;
var contains = util.contains;
var isArray = Array.isArray;

/**
 * Array schema type.
 *
 * @class SchemaTypeArray
 * @param {String} name
 * @param {Object} [options]
 *   @param {Boolean} [options.required=false]
 *   @param {Array|Function} [options.default=[]]
 *   @param {SchemaType} [options.child]
 * @constructor
 * @extends {SchemaType}
 * @module warehouse
 */
function SchemaTypeArray(name, options){
  SchemaType.call(this, name, extend({
    default: []
  }, options));

  /**
   * Child schema type.
   *
   * @property {SchemaType} child
   */
  this.child = this.options.child || new SchemaType(name);
}

util.inherits(SchemaTypeArray, SchemaType);

/**
 * Casts an array and its child elements.
 *
 * @method cast
 * @param {*} value
 * @param {Object} data
 * @return {Array}
 */
SchemaTypeArray.prototype.cast = function(value_, data){
  var value = SchemaType.prototype.cast.call(this, value_, data);
  if (value == null) return value;

  if (!isArray(value)) value = [value];
  if (!value.length) return value;

  var child = this.child;

  for (var i = 0, len = value.length; i < len; i++){
    value[i] = child.cast(value[i], data);
  }

  return value;
};

/**
 * Validates an array and its child elements.
 *
 * @method validate
 * @param {*} value
 * @param {Object} data
 * @return {Array|Error}
 */
SchemaTypeArray.prototype.validate = function(value_, data){
  var value = SchemaType.prototype.validate.call(this, value_, data);
  if (value instanceof Error) return value;

  if (!isArray(value)){
    return new ValidationError('`' + value + '` is not an array!');
  }

  if (!value.length) return value;

  var child = this.child;
  var result;

  for (var i = 0, len = value.length; i < len; i++){
    result = child.validate(value[i], data);

    if (result instanceof Error){
      return result;
    } else {
      value[i] = result;
    }
  }

  return value;
};

/**
 * Compares an array by its child elements and the size of the array.
 *
 * @method compare
 * @param {Array} a
 * @param {Array} b
 * @return {Number}
 */
SchemaTypeArray.prototype.compare = function(a, b){
  if (a){
    if (!b) return 1;
  } else {
    return b ? -1 : 0;
  }

  var lenA = a.length;
  var lenB = b.length;
  var child = this.child;
  var result;

  for (var i = 0, len = Math.min(lenA, lenB); i < len; i++){
    result = child.compare(a[i], b[i]);
    if (result !== 0) return result;
  }

  // Compare by length
  return lenA - lenB;
};

/**
 * Parses data.
 *
 * @method parse
 * @param {Array} value
 * @param {Object} data
 * @return {Array}
 */
SchemaTypeArray.prototype.parse = function(value, data){
  if (!value) return value;

  var len = value.length;
  if (!len) return [];

  var result = new Array(len);
  var child = this.child;

  for (var i = 0; i < len; i++){
    result[i] = child.parse(value[i], data);
  }

  return result;
};

/**
 * Transforms data.
 *
 * @method value
 * @param {Array} value
 * @param {Object} data
 * @return {Array}
 */
SchemaTypeArray.prototype.value = function(value, data){
  if (!value) return value;

  var len = value.length;
  if (!len) return [];

  var result = new Array(len);
  var child = this.child;

  for (var i = 0; i < len; i++){
    result[i] = child.value(value[i], data);
  }

  return result;
};

module.exports = SchemaTypeArray;