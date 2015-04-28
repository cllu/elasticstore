var should = require('chai').should();
var ValidationError = require('../../../lib/error/validation');

describe('SchemaTypeDate', function(){
  var SchemaTypeDate = require('../../../lib/types/date');
  var type = new SchemaTypeDate('test');

  it('cast()', function(){
    type.cast(new Date(2014, 1, 1)).should.eql(new Date(2014, 1, 1));
    type.cast(1e8).should.eql(new Date(1e8));
    type.cast('2014-11-03T07:45:41.237Z').should.eql(new Date('2014-11-03T07:45:41.237Z'));
  });

  it('cast() - default', function(){
    var date = new Date();
    var type = new SchemaTypeDate('test', {default: date});

    type.cast().should.eql(date);
  });

  function shouldThrowError(value){
    type.validate(value).should.be
      .instanceOf(ValidationError)
      .property('message', '`' + value + '` is not a valid date!');
  }

  it('validate()', function(){
    type.validate(new Date(2014, 1, 1)).should.eql(new Date(2014, 1, 1));
    shouldThrowError(1);
    shouldThrowError('foo');
    shouldThrowError([]);
    shouldThrowError(true);
    shouldThrowError({});
    shouldThrowError(new Date('foo'));
  });

  it('validate() - required', function(){
    var type = new SchemaTypeDate('test', {required: true});
    type.validate().should.be
      .instanceOf(ValidationError)
      .property('message', '`test` is required!');
  });

  it('match()', function(){
    type.match(new Date(2014, 1, 1), new Date(2014, 1, 1)).should.be.true;
    type.match(new Date(2014, 1, 1), new Date(2014, 1, 2)).should.be.false;
    type.match(undefined, new Date()).should.be.false;
  });

  it('compare()', function(){
    type.compare(new Date(2014, 1, 3), new Date(2014, 1, 2)).should.gt(0);
    type.compare(new Date(2014, 1, 1), new Date(2014, 1, 2)).should.lt(0);
    type.compare(new Date(2014, 1, 2), new Date(2014, 1, 2)).should.eql(0);
    type.compare(new Date()).should.eql(1);
    type.compare(undefined, new Date()).should.eql(-1);
    type.compare().should.eql(0);
  });

  it('parse()', function(){
    type.parse('2014-11-03T07:45:41.237Z').should.eql(new Date('2014-11-03T07:45:41.237Z'));
    should.not.exist(type.parse());
  });

  it('value()', function(){
    type.value(new Date('2014-11-03T07:45:41.237Z')).should.eql('2014-11-03T07:45:41.237Z');
    should.not.exist(type.value());
  });

});