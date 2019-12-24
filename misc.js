var uniqid = require('uniqid');
var tgresolve = require("tg-resolve");
module.exports = {
    uniqid: function() {
        return uniqid()
    },
  resolver: function(token, user) {
    // tg-resolve depricated, find alternative.
    tgresolve(token, user, function(error, result) {
    // ... handle error ...
      if(error) {
        return false
      }
      console.error(result.id);
      return result
    });
  }
}