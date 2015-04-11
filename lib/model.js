'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var Promise = require('bluebird');
var util = require('./util');
var Document = require('./document');
var Schema = require('./schema');
var Types = require('./types');
var ElasticstoreError = require('./error');
var Queue = require('./queue');

var parseArgs = util.parseArgs;
var reverse = util.reverse;
var shuffle = util.shuffle;
var getProp = util.getProp;
var setGetter = util.setGetter;
var extend = util.extend;
var isArray = Array.isArray;

/**
 * Model constructor.
 *
 * @class Model
 * @param {String} name Model name
 * @param {Schema|Object} [schema_] Schema
 * @constructor
 * @extends EventEmitter
 * @module warehouse
 */
function Model(name, schema_) {
  EventEmitter.call(this);

  var schema, i, len, key;

  // Define schema
  if (schema_ instanceof Schema) {
    schema = schema_;
  } else if (typeof schema_ === 'object') {
    schema = new Schema(schema_);
  } else {
    schema = new Schema();
  }

  // Set `_id` path for schema
  if (!schema.path('_id')) {
    schema.path('_id', {type: Types.CUID, required: true});
  }

  /**
   * Model name.
   *
   * @property {String} name
   * @private
   */
  this.name = name;

  /**
   * The doc_type used in ElasticSearch
   */
  this._es_doc_type = name.toLowerCase();

  /**
   * Data storage.
   *
   * @property {Object} data
   * @private
   */
  this.data = {};

  /**
   * Schema.
   *
   * @property {Schema} schema
   * @private
   */
  this.schema = schema;

  /**
   * The number of documents in model.
   *
   * @property {Number} length
   * @readOnly
   */
  this.length = 0;

  /**
   * Promise queue.
   *
   * @property {Queue} _queue
   * @private
   */
  this._queue = new Queue();

  /**
   * Document constructor for this model instance.
   *
   * @property {Function} Document
   * @param {Object} data
   * @constructor
   * @private
   */
  var _Document = this.Document = function (data) {
    Document.call(this, data);

    // Apply getters
    var err = schema._applyGetters(this);
    if (err) throw err;
  };

  util.inherits(_Document, Document);
  _Document.prototype._model = this;
  _Document.prototype._schema = schema;

  // Apply static methods
  var statics = schema.statics;
  var staticKeys = Object.keys(statics);

  for (i = 0, len = staticKeys.length; i < len; i++) {
    key = staticKeys[i];
    this[key] = statics[key];
  }

  // Apply instance methods
  var methods = schema.methods;
  var methodKeys = Object.keys(methods);

  for (i = 0, len = methodKeys.length; i < len; i++) {
    key = methodKeys[i];
    _Document.prototype[key] = methods[key];
  }
}

util.inherits(Model, EventEmitter);

/**
 * Creates a new document.
 *
 * @method new
 * @param {Object} data
 * @return {Document}
 */
Model.prototype.new = function (data) {
  return new this.Document(data);
};

/**
 * Finds a document by its identifier.
 *
 * @method get
 * @param {*} id
 * @param {Function} callback
 * @return {Document}
 */
Model.prototype.get = function (id, callback) {
  var self = this;
  return self._database.getClient().then(function (client) {
    return client.get({
      index: self._database._es_index,
      type: self._es_doc_type,
      id: id
    }).then(function (resp) {
      if (resp._source) {
        var data = resp._source;
        return new self.Document(data);
      } else {
        return null;
      }
    }, function (err) {
      if (err.message == 'Not Found') {
        return null;
      } else {
        throw err;
      }
    }).catch(function(err) {
      throw err;
    });
  }).nodeify(callback);
};

Model.prototype.findById = Model.prototype.get;

function execHooks(schema, type, event, data) {
  var hooks = schema.hooks[type][event];
  if (!hooks.length) return Promise.resolve(data);

  return Promise.each(hooks, function (hook) {
    return hook(data);
  }).thenReturn(data);
}

/**
 * Inserts a document.
 *
 * @method _saveOne
 * @param {Object} data_
 * @param {Function} [callback]
 * @return {Promise}
 */
Model.prototype._saveOne = function (data_, callback) {
  var self = this;
  var schema = this.schema;
  var result;

  return new Promise(function (resolve, reject) {
    // Apply getters
    var data = data_ instanceof self.Document ? data_ : new self.Document(data_);
    var id = data._id;

    // Check ID
    if (!id) {
      return reject(new ElasticstoreError('ID is not defined'));
    }

    resolve(data);
  }).then(function (data) {
      // Apply setters
      result = data.toObject();
      var err = schema._applySetters(result);

      if (err) return Promise.reject(err);

      // Pre-hooks
      return execHooks(schema, 'pre', 'save', data);
    }).then(function (data) {
      // Insert data to ElasticSearch
      return self._database.getClient().then(function (client) {

        return client.index({
          index: self._database._es_index,
          type: self._es_doc_type,
          id: data._id,
          body: data,
          // make sure the data is searchable instantly
          refresh: true
        }).then(function (resp) {

          /**
           * Fired when a document is inserted
           *
           * @event insert
           */
          self.emit('insert', data);
          return new self.Document(data);
        });
      });
    }).then(function (data) {
      return execHooks(schema, 'post', 'save', data);
    }).nodeify(callback);
};

/**
 * Save one or more documents.
 *
 * @method save
 * @param {Object|Array} data
 * @param {Function} [callback]
 * @return {Promise}
 */
Model.prototype.save = function (data, callback) {
  if (isArray(data)) {
    var self = this;

    return Promise.map(data, function (item) {


      return self._saveOne(item);
    }).then(function(docs){
      return self._database.getClient().then(function (client) {
        return client.indices.refresh({
          index: self._database._es_index
        }).then(function() {
          return docs;
        });
      })
    }).nodeify(callback);
  } else {
    return this._saveOne(data, callback);
  }
};

/**
 * Finds a document by its identifier and update it.
 *
 * @method updateById
 * @param {*} id
 * @param {Object} update
 * @param {Function} [callback]
 * @return {Promise}
 */
Model.prototype.updateById = function (id, update, callback) {
  // Check ID
  if (!id) {
    return new Promise(function (resovle, reject) {
      return reject(new ElasticstoreError('ID is not defined'));
    });
  }

  var self = this;

  return self.get(id)
    .then(function (doc) {
      return execHooks(self.schema, 'pre', 'save', doc)
    })
    .then(function () {
      return self._database.getClient().then(function (client) {
        return client.update({

          index: self._database._es_index,
          type: self._es_doc_type,
          id: id,
          body: {
            doc: update
          }
        })
      });
    })
    .then(function () {
      // fetch the updated document
      // TODO: another IO
      return self.get(id);
    })
    .then(function (data) {
      /**
       * Fired when a document is inserted
       *
       * @event insert
       */
      self.emit('update', data);
      return execHooks(self.schema, 'post', 'save', data);
    })
    .nodeify(callback);
};

/**
 * Drop all documents in this model
 *
 * @param callback
 * @returns {Promise}
 */
Model.prototype.drop = function (callback) {
  var self = this;

  return self._database.getClient().then(function (client) {
    return client.deleteByQuery({
      index: self._database._es_index,
      type: self._es_doc_type,
      body: {
        query: {
          match_all: {}
        }
      }
    });
  }).nodeify(callback);
};


/**
 * Finds a document by its identifier and remove it.
 *
 * @method remove
 * @param {*} id
 * @param {Function} [callback]
 * @return {Promise}
 */
Model.prototype.remove = function (id, callback) {
  var self = this;
  var schema = this.schema;

  return self.get(id)
    .then(function (data) { // Pre-hooks
      if (data == null) {
        throw new ElasticstoreError('ID `' + id + '` does not exist');
      }
      return execHooks(schema, 'pre', 'remove', data);
    }).then(function (data) { // Removes data

      // delete data from ElasticSearch
      return self._database.getClient().then(function (client) {
        return client.delete({
          index: self._database._es_index,
          type: self._es_doc_type,
          id: id,
          refresh: true
        }).then(function (resp) {
          /**
           * Fired when a document is removed
           *
           * @event remove
           */
          self.emit('remove', data);
          return data;
        });
      })
    }).then(function (data) {
      return execHooks(schema, 'post', 'remove', data);
    })
    .nodeify(callback);
};

Model.prototype.removeById = Model.prototype.remove;

/**
 * Returns the number of elements.
 *
 * @method count
 * @return {Number}
 */
Model.prototype.count = function (callback) {
  var self = this;
  return this._database.getClient().then(function (client) {
    return client.count({
      index: self._database._es_index,
      type: self._es_doc_type
    }).then(function (resp) {
      return resp.count;
    });
  }).nodeify(callback);
};

/**
 * Finds matching documents.
 *
 * @method find
 * @param {Object} filter
 * @param {Object} options
 * @param {Function} callback
 * @return {Array}
 */
Model.prototype.find = function (filter, options, callback) {
  var self = this;

  // the query body for ElasticSearch
  var query = {
    filtered: {
      query: {
        // so that documents will not be scored
        match_all: {}
      },
      filter: {
        term: filter
      }
    }
  };
  // if filter is null or empty, we return all documents
  if (!filter || _.keys(filter).length == 0) {
    delete query.filtered.filter;
  }

  var limit = (options && options.limit) ? options.limit : 10;
  var skip = (options && options.skip) ? options.skip : 0;

  return self._database.getClient().then(function (client) {
    return client.search({
      index: self._database._es_index,
      type: self._es_doc_type,
      body: {
        query: query
      },
      size: limit,
      from: skip
    }).then(function (resp) {
      return _.map(resp.hits.hits, function (hit) {
        return new self.Document(hit._source);
      });
    }).catch(function(err) {
      throw err;
    });
  }).nodeify(callback);
};


/**
 * Finds the first matching documents.
 *
 * @method findOne
 * @param {Object} query
 * @return {Document|Object}
 */
Model.prototype.findOne = function(query){

  return this.find(query).then(function (docs) {
    if (docs.length > 0) {
      return docs[0];
    } else {
      return null;
    }
  });
};

Model.prototype.findAll = function(query) {
  return this.find(query, {limit: 10000});
};

Model.prototype.deleteMapping = function (callback) {
  var self = this;
  return self._database.getClient().then(function (client) {
    return client.indices.deleteMapping({
      index: self._database._es_index,
      type: self._es_doc_type
    }).catch(function (err) {
      console.log('error deleting mappings');
      console.log(err);
    });
  }).nodeify(callback);
};


module.exports = Model;