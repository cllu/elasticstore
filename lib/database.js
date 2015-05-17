'use strict';

var Promise = require('bluebird');
var SchemaType = require('./schematype');
var ElasticstoreError = require('./error');
var pkg = require('../package.json');
var _ = require('lodash');
var elasticsearch = require('elasticsearch');
var Node = require('./node');

/**
 * Database constructor.
 *
 * @class Database
 * @param {Object} [options]
 *   @param {Number} [options.version=0] Database version
 *   @param {String} [options.host] ElasticSearch host, such as localhost:9200
 * @constructor
 * @module warehouse
 */
function Database(options) {
  /**
   * Database options.
   *
   * @property {Object} options
   * @private
   */
  this.options = _.merge({
    version: 0,
    onUpgrade: function () {
    },
    onDowngrade: function () {
    }
  }, options);

  this._index = this.options.name;
  this._models = {};
}

/**
 * Register a new type
 *
 * @param Type
 * @param context the application context
 * @returns {*}
 */
Database.prototype.registerType = function (Type, context) {

  Type._store = this;
  Type._context = context;

  // DO NOT bind for Node itself, or bad things happen!
  if (Type.name !== 'Node') {
    Type.getContext = Node.getContext.bind(Type);
    Type.getStore = Node.getStore.bind(Type);
    Type.getStoreClient = Node.getStoreClient.bind(Type);
    Type.getIndex = Node.getIndex.bind(Type);
    Type.getType = Node.getType.bind(Type);

    Type.createInstance = Node.createInstance.bind(Type);
    Type.find = Node.find.bind(Type);
    Type.findById = Node.findById.bind(Type);
    Type.findOne = Node.findOne.bind(Type);
    Type.findAll = Node.findAll.bind(Type);
    Type.removeById = Node.removeById.bind(Type);
    Type.updateById = Node.updateById.bind(Type);
    Type.insert = Node.insert.bind(Type);
    Type.insertOne = Node.insertOne.bind(Type);
    Type.drop = Node.drop.bind(Type);

    Type.addHook = Node.addHook.bind(Type);
    Type.executeHooks = Node.executeHooks.bind(Type);
  }

  // lets create an instance so we can get the _type
  Type._type = Type._type || 'node';

  this._models[Type.name] = Type;

  return Type;
};

Database.prototype.getModel = function (name) {
  return this._models[name];
};

/**
 * Connects to the ElasticSearch server.
 *
 * @method connect
 * @param {Function} [callback]
 * @return {Promise}
 */
Database.prototype.connect = function (callback) {

  if (!this.options.name) {
    throw new ElasticstoreError('No database name has been specified');
  }

  this.client = new elasticsearch.Client({
    host: this.options.host,
    //log: 'trace'
    log: 'info'
  });

  var self = this;
  var client = this.client;
  var index = this.options.name;
  var version = this.options.version;

  var pCheckIndex = client.indices.exists({index: index});
  // return the version number if we have created the datastore
  var pEnsureIndexExists = pCheckIndex.then(function (exists) {
    if (exists) return null;

    return client.indices.create({index: index, body: {
      settings: self.options.settings || {},
      mappings: self.options.mappings || {}
    }}).then(function () {
      console.log('datastore has been created');

      // put the version information
      return client.index({
        index: index,
        type: 'elasticstore',
        id: 'version',
        body: {
          version: version
        }
      }).then(function () {
        return version;
      })
    });
  });

  var pCheckVersion = pEnsureIndexExists.then(function (oldVersion) {
    if (oldVersion) return oldVersion;

    return client.get({
      index: index,
      type: 'elasticstore',
      id: 'version'
    }).then(function (resp) {
      return resp._source.version;
    })
  });

  var pUpgradeOrDowngrade = pCheckVersion.then(function (oldVersion) {
    if (oldVersion == version) {
      return null;
    } else if (oldVersion > version) {
      return self.options.onDowngrade(oldVersion, version);
    } else if (oldVersion < version) {
      return self.options.onUpgrade(oldVersion, version);
    }
  });

  return pUpgradeOrDowngrade.catch(function (err) {
    throw err;
  }).nodeify(callback);
};

Database.prototype.getClient = function () {
  var self = this;

  if (self.client) {
    return Promise.resolve(self.client);
  }

  return this.connect().then(function () {
    return self.client;
  })
};

/**
 * Drop all mappings
 */
Database.prototype.dropMappings = function () {
  //this.client.indices.delete({index: this.options.name}),
  return this.client.indices.deleteMapping({index: this.options.name, type: '_all'})
    .catch(function(err){
      console.log(err);
    });
};

/**
 * Drop the whole index, including mappings and data
 */
Database.prototype.drop = function () {
  // no need to perform full connect
  this.client = new elasticsearch.Client({
    host: this.options.host,
    //log: 'trace'
    log: 'info'
  });

  return this.client.indices.delete({index: this.options.name})
    .catch(function (err) {
      throw err;
    });
};

/**
 * Close the ElasticSearch connection.
 *
 * @method save
 * @return {Promise}
 */
Database.prototype.close = function () {
  if (this.client) {
    this.client.close();
  }
};

/**
 * Warehouse version.
 *
 * @property {String} version
 * @static
 */
Database.version = pkg.version;

module.exports = Database;