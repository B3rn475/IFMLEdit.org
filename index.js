/*jslint node: true */
"use strict";

var express = require('express');

var server = express();

server.use('/api/', require('./server').createRouter());
server.use(express["static"]('public', {index: 'index.html'}));

server.listen(3000, function () {
    console.log("Server listening on port 3000");
});
