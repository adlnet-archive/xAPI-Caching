/*
 * Main server router
 */

var http = require('http'),
	express = require('express'),
	//iso8601 = require('node-iso8601'),
	
	config = require('./config.json');


var app = express();

app.post('/freshen', function(req,res,next)
{
	if(config.manualFreshen === true)
	{
		res.status(200).send();
	}
	else {
		res.status(403).send();
	}
});

app.get('/', function(req,res,next){
	res.send('Hello World!');
});

// all else fails, 404
app.use(function(req,res){
	res.status(404).send();
});

http.createServer(app).listen(config.port);

