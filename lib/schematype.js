'use strict';

var _ = require('lodash');
var ValidationError = require('./error/validation');

/**
 * SchemaType constructor.
 *
 * This is the basic schema type. All schema types should inherit from this
 * class. For example:
 *
 * ``` js
 * var SchemaTypeCustom = function(name, options){
 *   SchemaType.call(this, name, options);
 * };
 *
 * require('util').inherits(SchemaTypeCustom, SchemaType);
 * ```
 *
 * The `value` parameter is the value of specified field; the `query` parameter
 * is the value passed to the query operator; the `data` parameter is the
 * complete data.
 *
 * The return value must be a boolean indicating whether the data passed.
 *
 * @class SchemaType
 * @param {String} name
 * @param {Object} [options]
 *   @param {Boolean} [options.required=false]
 *   @param {*} [options.default]
 * @constructor
 * @module warehouse
 */
function SchemaType(name, options){
  /**
   * Field name.
   *
   * @property {String} name
   */
  this.name = name || '';

  /**
   * Options.
   *
   * @property {Object} options
   */
  this.options = _.merge({
    required: false
  }, options);

  var default_ = this.options.default;

  /**
   * The function that returns default value.
   *
   * @property {Function} default
   */
  if (typeof default_ === 'function'){
    this.default = default_;
  } else {
    this.default = function(){
      return default_;
    };
  }
}

/**
 * Casts data. This function is used by getters to cast an object to document
 * instances. If the value is null, the default value will be returned.
 *
 * @method cast
 * @param {*} value
 * @param {Object} data
 * @return {*}
 */
SchemaType.prototype.cast = function(value, data){
  if (value == null){
    return this.default();
  } else {
    return value;
  }
};

/**
 * Validates data. This function is used by setters.
 *
 * @method validate
 * @param {*} value
 * @param {Object} data
 * @return {*|Error}
 */
SchemaType.prototype.validate = function(value, data){
  if (this.options.required && value == null){
    return new ValidationError('`' + this.name + '` is required!');
  }

  return value;
};

/**
 * Parses data. This function is used when restoring data from database files.
 *
 * @method parse
 * @param {*} value
 * @param {Object} data
 * @return {*}
 */
SchemaType.prototype.parse = function(value, data){
  return value;
};

/**
 * Transforms value. This function is used when saving data to database files.
 *
 * @method value
 * @param {*} value
 * @param {Object} data
 * @return {*}
 */
SchemaType.prototype.value = function(value, data){
  return value;
};

/**
 * Checks the equality of data.
 *
 * @method match
 * @param {*} value
 * @param {*} query
 * @param {Object} data
 * @return {Boolean}
 */
SchemaType.prototype.match = function(value, query, data){
  return value === query;
};

module.exports = SchemaType;