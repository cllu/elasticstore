'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var util = require('./util');
var Schema = require('./schema');
var Types = require('./types');
var ElasticstoreError = require('./error');

var parseArgs = util.parseArgs;
var reverse = util.reverse;
var shuffle = util.shuffle;
var getProp = util.getProp;
var setGetter = util.setGetter;
var extend = util.extend;
var isArray = Array.isArray;

var NodeOperation = require('./node_operation');


/**
 * Node constructor.
 *
 * A node has the following core properties
 *
 * - _type, used as index _type in ElasticSearch
 * - _schema, property schema, specify which properties are required or has default value
 *
 * @class Node
 * @constructor
 * @extends EventEmitter
 * @module warehouse
 */
function Node(data) {

  NodeOperation.call(this);

  /**
   * Node type
   *
   * @property {String} _type
   * @private
   */
  this._type = this.constructor._type || 'node';

  /**
   * Node shema
   * @type {*|{}}
   * @private
   */
  this._schema = this.constructor._schema || {};

  // apply data attributes
  _.forOwn(data, function (value, key) {
    this[key] = value;
  }, this);

  // check and apply schema
  _.forOwn(this._schema, function (value, key) {
    // check whether required properties are set
    if (value.required && !_.has(this, key)) {
      throw new ElasticstoreError(key + ' is required but missing');
    }

    // set default properties
    if (_.has(value, 'default') && !_.has(this, key)) {
      if (value.default instanceof Function) {
        this[key] = value.default();
      } else {
        this[key] = value.default;
      }
    }
  }, this);
}

util.inherits(Node, NodeOperation);

/**
 * Returns a plain JavaScript object.
 *
 * @method toObject
 * @return {Object}
 */
Node.prototype.toObject = function(){
  var keys = Object.keys(this);
  var obj = {};
  var key;

  for (var i = 0, len = keys.length; i < len; i++){
    key = keys[i];
    // Don't deep clone getters in order to avoid "Maximum call stack size
    // exceeded" error
    obj[key] = isGetter(this, key) ? this[key] : _.cloneDeep(this[key]);
  }

  return obj;
};

module.exports = Node;