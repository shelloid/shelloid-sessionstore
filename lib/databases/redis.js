'use strict';

var util = require('util'),
    Session = require('../sessionInterface'),
    _ = require('lodash'),
    async = require('async'),
    redis = require('redis'),
    jsondate = require('jsondate');

var RedisSessionStore = function (options) {
  options = options || {};
  Session.Store.call(this, options);

  var defaults = {
	dbname: "redis",
    prefix: 'sess',
    ttl: 804600,
    max_attempts: 1
  };

  _.defaults(options, defaults);

  this.options = options;
};

util.inherits(RedisSessionStore, Session.Store);

_.extend(RedisSessionStore.prototype, {

  connect: function (callback) {
    var self = this;

    var options = this.options;
	
	this.dbConfig = options.dbConfig;
	
    this.prefix = options.prefix;

    this.ttl = options.ttl;
	
	var calledBack = false;
	
	this.dbConfig.pool.acquire(
        function (err, client) {
			self.client = client;
			if(client){
				gotClient.apply(self);
			}
			if (callback){
				calledBack = true;
				callback(err, self);
				return;
			}
			if (err) throw err;
		}
	);

	var gotClient = function(){
		if (options.db) {
		  this.client.select(options.db);
		}

		this.client.on('end', function () {
		  self.disconnect();
		});

		this.client.on('error', function (err) {
		  console.log(err);

		  if (calledBack) return;
		  calledBack = true;
		  if (callback) callback(null, self);
		});

		this.client.on('connect', function () {
		  if (options.db) {
			self.client.send_anyways = true;
			self.client.select(options.db);
			self.client.send_anyways = false;
		  }
		  
		  self.emit('connect');

		  if (calledBack) return;
		  calledBack = true;
		  if (callback) callback(null, self);
		});
	}
  },

  disconnect: function (callback) {
    this.client.end();
    this.emit('disconnect');
    if (callback) callback(null, this);
  },

  set: function (sid, sess, callback) {
    var prefixedSid = this.prefix + ':' + sid;

    try {
      var ttl = this.ttl;
      sess = JSON.stringify(sess);
      this.client.setex(prefixedSid, ttl, sess, callback  || function () {});
    } catch (err) {
      if (callback) callback(err);
    }
  },

  get: function (sid, callback) {
    var prefixedSid = this.prefix + ':' + sid;

    this.client.get(prefixedSid, function (err, data) {
      if (err) {
        if (callback) callback(err);
        return;
      }
      if (!data) {
        if (callback) callback(null, null);
        return;
      }

      var result;

      try {
        result = jsondate.parse(data.toString());
      } catch (error) {
        if (callback) callback(err);
        return;
      }

      if (callback) callback(null, result);
    });
  },

  destroy: function (sid, callback) {
    var prefixedSid = this.prefix + ':' + sid;
    this.client.del(prefixedSid, callback || function () {});
  },

  all: function (callback) {
    var self = this;
    this.client.keys(this.prefix + ':*', function(err, docs) {
      async.map(docs, function(doc, callback) {
        self.client.get(doc, function (err, data) {
          if (err) {
            if (callback) callback(err);
            return;
          }
          if (!data) {
            if (callback) callback(null, null);
            return;
          }

          var result;

          try {
            result = jsondate.parse(data.toString());
          } catch (error) {
            if (callback) callback(err);
            return;
          }

          if (callback) callback(null, result);
        });
      }, callback);
    });
  },

  length: function (callback) {
    this.client.keys(this.prefix + ':*', function (err, docs) {
      if (err) {
        if (callback) callback(err);
        return;
      }

      if (callback) callback(null, docs.length);
    });
  },

  clear: function (callback) {
    var self = this;
    this.client.keys(this.prefix + ':*', function(err, docs) {
      async.each(docs, function(doc, callback) {
        self.client.del(doc, callback);
      }, callback || function () {});
    });
  }

});

module.exports = RedisSessionStore;
