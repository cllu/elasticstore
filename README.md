# ElasticStore

ElasticStore provides a high-level MongoDB-like API for ElasticSearch. 
It aims to be minimal.

## Installation

``` bash
$ npm install elasticstore
```

## Usage

``` js
var Database = require('elasticstore');
var db = new Database();

// create a model
var Post = db.model('posts', {
  title: String,
  created: {type: Date, default: Date.now}
});

Post.insert({
  title: 'Hello world'
}).then(function(post){
  console.log(post);
});
```

New design:
``` js
var Store = require('elasticstore').Store;
var store = new Store();
var Node = store.Node;

// create a new Node type
function Post() {
  Node.call(this);
  
  this.schema = {
    title: String,
    created: {type: Date, default: Date.now}
  };
}

Node.registerType(Post);

// create a new instance
Post.insert({
  title: 'Hello world'
}).then(function(post){
  console.log(post);
});
```

## Design
A datastore is corresponding to an index.
A model is corresponding to a document type in ElasticSearch.

### Datastore methods

- `connect()`, connect to ElasticSearch
- `model(name, schema)`, create a new model
- `registerType(Type)`, to create a subclass of Node, include a call to `util.inherits(Type, Node)`.

### Node methods

Access the Node class by `store.Node`.

- `getContext`
- `getStore`
- `getStoreClient`
- `getIndex`
- `getType`

- `find(q)`, find all matching document. if q is null, return all documents
- `findById(id)`, (`get` is aliased) find the document with the given id
- `save(doc_or_docs_array)`, insert a new document to this model
- `updateById(id, values)`
- `removeById(id)`, (`remove` is aliased) remove all documents in this model
- `count(q)`, return the number of documents matching the query
- `createInstance(data)`, create a new document of this model

To create a subclass, use the following snippet:

```js
function Post() {
  Node.call(this);
}
Node.registerType(Post);
```

Then you need to access the methods by `Post.findById` etc.


### Model instance methods

You can create a new Model instance by `new Model()`.

- `getContext()`
- `save()`
- `remove()`
- `update()`

## Test

ORG_PKG=/Users/cllu/Projects/OrganizedApp/ ./vendor/elasticsearch-1.4.4/bin/elasticsearch -D es.config=/Users/cllu/Projects/OrganizedApp/etc/elasticsearch/elasticsearch.yml

``` bash
$ gulp test
```


## Gothas

### Index refresh

After ElasticSearch indexes a document, it needs some time before the document is searchable.
To simplify the logic, the `save()` method has a `refresh` optional parameter which is True by default.

## Mapping

Ensure to set `index.mapping.coerce: false` so that ES will not try to coerce numerical values.