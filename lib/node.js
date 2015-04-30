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
 * - name, used as index _type in ElasticSearch
 * - schema, property schema
 *
 * @class Node
 * @constructor
 * @extends EventEmitter
 * @module warehouse
 */
function Node(data) {

  NodeOperation.call(this);

  /**
   * Node name.
   *
   * @property {String} name
   * @private
   */
  this._type = 'node';

  /**
   * Schema.
   *
   * @property {Schema} schema
   * @private
   */
  this.schema = new Schema();
  // Set `_id` path for schema
  if (!this.schema.path('_id')) {
    this.schema.path('_id', {type: Types.CUID, required: true});
  }

  /**
   * The number of documents in Node.
   *
   * @property {Number} length
   * @readOnly
   */
  this.length = 0;

  // apply data attributes
  if (data){
    var keys = Object.keys(data);
    var key;

    for (var i = 0, len = keys.length; i < len; i++) {
      key = keys[i];
      this[key] = data[key];
    }
  }
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