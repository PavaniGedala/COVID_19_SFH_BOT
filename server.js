
'use strict';

require('dotenv').config({ silent: true });

var server = require('./app');
var port = process.env.PORT || 3001;

server.listen(port, function () {
  console.log('Server running on port: %d', port);
});
