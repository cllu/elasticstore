var should = require('chai').should();
var ValidationError = require('../../../lib/error/validation');

describe('SchemaTypeNumber', function(){
  var SchemaTypeNumber = require('../../../lib/types/number');
  var type = new SchemaTypeNumber('type');

  it('cast()', function(){
    type.cast(0).should.eql(0);
    type.cast(1).should.eql(1);
    type.cast('0').should.eql(0);
    type.cast('1').should.eql(1);
    type.cast(true).should.eql(1);
    type.cast(false).should.eql(0);
  });

  it('cast() - default', function(){
    var type = new SchemaTypeNumber('type', {default: 42});
    type.cast().should.eql(42);
  });

  function shouldThrowError(value){
    type.validate(value).should.be
      .instanceOf(ValidationError)
      .property('message', '`' + value + '` is not a number!');
  }

  it('validate()', function(){
    type.validate(1).should.eql(1);
    type.validate(0).should.eql(0);
    shouldThrowError(NaN);
    shouldThrowError('');
    shouldThrowError([]);
    shouldThrowError(true);
    shouldThrowError(false);
    shouldThrowError({});
  });

  it('validate() - required', function(){
    var type = new SchemaTypeNumber('test', {required: true});
    type.validate().should.be
      .instanceOf(ValidationError)
      .property('message', '`test` is required!');
  });

});