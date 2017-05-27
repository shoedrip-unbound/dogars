#!/bin/node

let http = require('http');
let router = require('./routes.js').router

var server = http.createServer(router);
server.listen(1234);
