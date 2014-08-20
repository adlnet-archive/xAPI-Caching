/*
 * Main server router
 */

var http = require('http'),
	express = require('express'),
	
	config = require('./config.json');

var app = express();

app.get('/', function(req,res,next){
	res.send('Hello World!');
});

http.createServer(app).listen(config.port);

