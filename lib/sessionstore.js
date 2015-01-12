'use strict';

var sessionInterface = require('../lib/sessionInterface'),
    tolerate = require('tolerance');

function getSpecificStore(options) {
   var supportedTypes = ["inmemory", "redis"];
  
  options = options || {};
  
  if(options.dbname){
	  options.dbConfig = shelloid.getDBConfig(options.dbname);
	  if(!options.dbConfig){
		throw new Error(sh.loc("Cannot find configuration for the session store DB: " + options.dbname));
	  }
	  options.type = options.dbConfig.type;
  }  

  options.type = options.type || 'inmemory';

  options.type = options.type.toLowerCase();
    
  if(supportedTypes.indexOf(options.type) < 0){
	throw new Error("The session store type: " + options.type + " is not supported yet");
  }   
  
  var dbPath = __dirname + "/databases/" + options.type + ".js";

  var exists = require('fs').existsSync || require('path').existsSync;
  if (!exists(dbPath)) {
    var errMsg = 'Implementation for db "' + options.type + '" does not exist!';
    console.log(errMsg);
    throw new Error(errMsg);
  }

  try {
    var db = require(dbPath);
    return db;
  } catch (err) {

    if (err.message.indexOf('Cannot find module') >= 0 &&
        err.message.indexOf("'") > 0 &&
        err.message.lastIndexOf("'") !== err.message.indexOf("'")) {

      var moduleName = err.message.substring(err.message.indexOf("'") + 1, err.message.lastIndexOf("'"));
      console.log('Please install module "' + moduleName +
                  '" to work with db implementation "' + options.type + '"!');
    }

    throw err;
  }
}

module.exports = {
  createSessionStore: function(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    options = options || {};

    var Store;

    try {
      Store = getSpecificStore(options);
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }

    var store = new Store(options);
    process.nextTick(function() {
      tolerate(function(callback) {
        store.connect(callback);
      }, options.timeout || 0, callback || function () {});
    });
    return store;
  }
};
