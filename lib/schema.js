'use strict';

var Promise = require('bluebird');
var SchemaType = require('./schematype');
var Types = require('./types');
var util = require('./util');

var getProp = util.getProp;
var setProp = util.setProp;
var delProp = util.delProp;
var isArray = Array.isArray;

var builtinTypes = {
  String: true,
  Number: true,
  Boolean: true,
  Array: true,
  Object: true,
  Date: true
};

/**
 * Schema constructor.
 *
 * @class Schema
 * @param {Object} schema
 * @constructor
 * @module warehouse
 */
function Schema(schema){
  /**
   * Schema paths.
   *
   * @property {Object} paths
   * @private
   */
  this.paths = {};

  /**
   * Static methods.
   *
   * @property {Object} statics
   * @private
   */
  this.statics = {};

  /**
   * Instance methods.
   *
   * @property {Object} methods
   * @private
   */
  this.methods = {};

  /**
   * Hooks.
   *
   * @property {Object} hooks
   * @private
   */
  this.hooks = {
    pre: {
      save: [],
      remove: []
    },
    post: {
      save: [],
      remove: []
    }
  };

  /**
   * Cache stacks.
   *
   * @property {Object} stacks
   * @private
   */
  this.stacks = {
    getter: [],
    setter: [],
    import: [],
    export: []
  };

  if (schema){
    this.add(schema);
  }
}

/**
 * Adds paths.
 *
 * @method add
 * @param {Object} schema
 * @param {String} prefix_
 */
Schema.prototype.add = function(schema, prefix_){
  var prefix = prefix_ || '';
  var keys = Object.keys(schema);
  var len = keys.length;
  var key, value;

  if (!len) return;

  for (var i = 0; i < len; i++){
    key = keys[i];
    value = schema[key];

    this.path(prefix + key, value);
  }
};

function getSchemaType(name, options){
  var Type = options.type || options;
  var typeName = Type.name;

  if (builtinTypes[typeName]){
    return new Types[typeName](name, options);
  } else {
    return new Type(name, options);
  }
}

/**
 * Gets/Sets a path.
 *
 * @method path
 * @param {String} name
 * @param {*} obj
 * @return {SchemaType}
 */
Schema.prototype.path = function(name, obj){
  if (obj == null){
    return this.paths[name];
  }

  var type;
  var nested = false;

  if (obj instanceof SchemaType){
    type = obj;
  } else {
    switch (typeof obj){
      case 'function':
        type = getSchemaType(name, {type: obj});
        break;

      case 'object':
        if (obj.type){
          type = getSchemaType(name, obj);
        } else if (isArray(obj)){
          type = new Types.Array(name, {
            child: obj.length ? getSchemaType(name, obj[0]) : new SchemaType(name)
          });
        } else {
          type = new Types.Object();
          nested = Object.keys(obj).length > 0;
        }

        break;

      default:
        throw new TypeError('Invalid value for schema path `' + name + '`');
    }
  }

  this.paths[name] = type;
  this._updateStack(name, type);

  if (nested) this.add(obj, name + '.');
};

/**
 * Updates cache stacks.
 *
 * @method _updateStack
 * @param {String} name
 * @param {SchemaType} type
 * @private
 */
Schema.prototype._updateStack = function(name, type){
  var stacks = this.stacks;

  stacks.getter.push(function(data){
    var value = getProp(data, name);
    var result = type.cast(value, data);

    if (result instanceof Error) return result;

    if (result !== undefined){
      setProp(data, name, result);
    }
  });

  stacks.setter.push(function(data){
    var value = getProp(data, name);
    var result = type.validate(value, data);

    if (result instanceof Error) return result;

    if (result !== undefined){
      setProp(data, name, result);
    } else {
      delProp(data, name);
    }
  });

  stacks.import.push(function(data){
    var value = getProp(data, name);
    var result = type.parse(value, data);

    if (result instanceof Error) return result;

    if (result !== undefined){
      setProp(data, name, result);
    }
  });

  stacks.export.push(function(data){
    var value = getProp(data, name);
    var result = type.value(value, data);

    if (result instanceof Error) return result;

    if (result !== undefined){
      setProp(data, name, result);
    } else {
      delProp(data, name);
    }
  });
};

/**
 * Adds a virtual path.
 *
 * @method virtual
 * @param {String} name
 * @param {Function} [getter]
 * @return {Promise} {SchemaType.Virtual}
 */
Schema.prototype.virtual = function(name, getter){
  var virtual = new Types.Virtual(name, {});
  if (getter) virtual.get(getter);

  this.path(name, virtual);

  return virtual;
};

function checkHookType(type){
  if (type !== 'save' && type !== 'remove'){
    throw new TypeError('Hook type must be `save` or `remove`!');
  }
}

function hookWrapper(fn){
  if (fn.length > 1){
    return function(data){
      return new Promise(function(resolve, reject){
        fn(data, function(err){
          if (err){
            reject(err);
          } else {
            resolve();
          }
        });
      });
    };
  } else {
    return Promise.method(fn);
  }
}

/**
 * Adds a pre-hook.
 *
 * @method pre
 * @param {String} type Hook type. One of `save` or `remove`.
 * @param {Function} fn
 */
Schema.prototype.pre = function(type, fn){
  checkHookType(type);
  if (typeof fn !== 'function') throw new TypeError('Hook must be a function!');

  this.hooks.pre[type].push(hookWrapper(fn));
};

/**
 * Adds a post-hook.
 *
 * @method post
 * @param {String} type Hook type. One of `save` or `remove`.
 * @param {Function} fn
 */

Schema.prototype.post = function(type, fn){
  checkHookType(type);
  if (typeof fn !== 'function') throw new TypeError('Hook must be a function!');

  this.hooks.post[type].push(hookWrapper(fn));
};

/**
 * Adds a instance method.
 *
 * @method method
 * @param {String} name
 * @param {Function} fn
 */
Schema.prototype.method = function(name, fn){
  if (!name) throw new TypeError('Method name is required!');

  if (typeof fn !== 'function'){
    throw new TypeError('Instance method must be a function!');
  }

  this.methods[name] = fn;
};

/**
 * Adds a static method.
 *
 * @method static
 * @param {String} name
 * @param {Function} fn
 */
Schema.prototype.static = function(name, fn){
  if (!name) throw new TypeError('Method name is required!');

  if (typeof fn !== 'function'){
    throw new TypeError('Static method must be a function!');
  }

  this.statics[name] = fn;
};

/**
 * Apply getters.
 *
 * @method _applyGetters
 * @param {Object} data
 * @return {*}
 * @private
 */
Schema.prototype._applyGetters = function(data){
  var stack = this.stacks.getter;
  var err;

  for (var i = 0, len = stack.length; i < len; i++){
    err = stack[i](data);
    if (err instanceof Error) return err;
  }
};

/**
 * Apply setters.
 *
 * @method _applySetters
 * @param {Object} data
 * @return {*}
 * @private
 */
Schema.prototype._applySetters = function(data){
  var stack = this.stacks.setter;
  var err;

  for (var i = 0, len = stack.length; i < len; i++){
    err = stack[i](data);
    if (err instanceof Error) throw err;
  }
};

/**
 * @property {Object} Types
 * @static
 */
Schema.Types = Schema.prototype.Types = Types;

module.exports = Schema;