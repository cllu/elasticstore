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

## Design
A datastore is corresponding to an index.
A model is corresponding to a document type in ElasticSearch.

### Datastore methods

- `connect()`, connect to ElasticSearch
- `model(name, schema)`, create a new model

### Model methods

- `find(q)`, find all matching document. if q is null, return all documents
- `get(id)`, find the document with the given id
- `save(doc_or_docs_array)`, insert a new document to this model
- `updateById(id, values)`
- `remove(id)`, remove all documents in this model
- `count(q)`, return the number of documents matching the query
- `new(data)`, create a new document of this model

### Document methods

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