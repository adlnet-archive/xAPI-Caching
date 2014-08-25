/*
 * Main server router
 */

var http = require('http'),
	express = require('express'),
	morgan = require('morgan'),
	
	config = require('./config.json'),
	process = require('./process.js');


var app = express();

app.use(morgan('combined'));

app.post('/:collectId/freshen', function(req,res,next)
{
	if( config.collections[req.params.collectId] )
	{
		if(config.collections[req.params.collectId].manualFreshen === true)
			process.freshen(req.params.collectId, req,res);
		else
			res.status(403).send();
	}
	else {
		next();
	}
});

app.get('/:collectId', function(req,res,next)
{
	if( config.collections[req.params.collectId] )
		process.serveResults(req.params.collectId, req,res);
	else
		next();
});

app.get('/', function(req,res,next){
	res.send('Hello World!');
});

// all else fails, 404
app.use(function(req,res){
	res.status(404).send('<h1>404 Not Found</h1>');
});

http.createServer(app).listen(config.port);
console.log('Listening on port '+config.port);
