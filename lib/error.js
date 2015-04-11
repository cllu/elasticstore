'use strict';

var util = require('./util');

function ElasticstoreError(msg){
  Error.call(this);
  Error.captureStackTrace && Error.captureStackTrace(this, ElasticstoreError);

  this.name = 'ElasticstoreError';
  this.message = msg;
}

util.inherits(ElasticstoreError, Error);

module.exports = ElasticstoreError;