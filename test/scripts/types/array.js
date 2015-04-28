var should = require('chai').should();
var ValidationError = require('../../../lib/error/validation');

describe('SchemaTypeArray', function(){
  var SchemaTypeArray = require('../../../lib/types/array');
  var SchemaTypeString = require('../../../lib/types/string');
  var SchemaTypeDate = require('../../../lib/types/date');
  var SchemaTypeBoolean = require('../../../lib/types/boolean');
  var type = new SchemaTypeArray('test');

  it('cast()', function(){
    type.cast('foo').should.eql(['foo']);
    type.cast([]).should.eql([]);
    type.cast([1, 2, 3]).should.eql([1, 2, 3]);
    type.cast().should.eql([]);
  });

  it('cast() - default', function(){
    var type = new SchemaTypeArray('test', {default: [1, 2, 3]});
    type.cast().should.eql([1, 2, 3]);
  });

  it('cast() - child', function(){
    var type = new SchemaTypeArray('test', {child: new SchemaTypeString()});
    type.cast([1, 2, 3]).should.eql(['1', '2', '3']);
  });

  function shouldThrowError(value){
    type.validate(value).should.be
      .instanceOf(ValidationError)
      .property('message', '`' + value + '` is not an array!');
  }

  it('validate()', function(){
    type.validate([]).should.eql([]);
    type.validate([1, 2, 3]).should.eql([1, 2, 3]);
    shouldThrowError('');
    shouldThrowError('foo');
    shouldThrowError(0);
    shouldThrowError(1);
    shouldThrowError({});
    shouldThrowError(true);
  });

  it('validate() - required', function(){
    var type = new SchemaTypeArray('test', {required: true});

    type.validate().should.be
      .instanceOf(ValidationError)
      .property('message', '`test` is required!');
  });

  it('validate() - child', function(){
    var type = new SchemaTypeArray('test', {child: new SchemaTypeString()});

    type.validate([1, 2, 3]).should.be
      .instanceOf(ValidationError)
      .property('message', '`1` is not a string!');
  });

  it('compare()', function(){
    type.compare([1, 2, 3], [1, 2, 4]).should.eql(-1);
    type.compare([1, 2, 3], [1, 2, 3]).should.eql(0);
    type.compare([1, 2, 3], [1, 2, 2]).should.eql(1);
    type.compare([1, 2, 3, 4], [1, 2, 3]).should.eql(1);
    type.compare(undefined, []).should.eql(-1);
    type.compare([]).should.eql(1);
    type.compare().should.eql(0);
  });

  it('compare() - child', function(){
    var type = new SchemaTypeArray('test', {child: new SchemaTypeDate()});
    type.compare([new Date(1e8), new Date(1e8 + 1)], [new Date(1e8), new Date(1e8 + 2)])
      .should.eql(-1);
  });

  it('parse()', function(){
    type.parse([1, 2, 3]).should.eql([1, 2, 3]);
    should.not.exist(type.parse());
  });

  it('parse() - child', function(){
    var type = new SchemaTypeArray('test', {child: new SchemaTypeBoolean()});
    type.parse([0, 1, 0]).should.eql([false, true, false]);
  });

  it('value()', function(){
    type.value([1, 2, 3]).should.eql([1, 2, 3]);
    should.not.exist(type.value());
  });

  it('value() - child', function(){
    var type = new SchemaTypeArray('test', {child: new SchemaTypeBoolean()});
    type.value([true, false, true]).should.eql([1, 0, 1]);
  });

});