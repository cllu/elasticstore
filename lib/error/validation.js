'use strict';

var util = require('util');
var ElasticstoreError = require('./index');

function ValidationError(msg){
  Error.call(this);
  Error.captureStackTrace && Error.captureStackTrace(this, ValidationError);

  this.name = 'ValidationError';
  this.message = msg;
}

util.inherits(ValidationError, ElasticstoreError);

module.exports = ValidationError;