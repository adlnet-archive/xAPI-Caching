/*
 * Main server router
 */

var http = require('http'),
	express = require('express'),
	morgan = require('morgan'),
	
	config = require('./config.json'),
	process = require('./process.js');


(function checkConfigSanity()
{
	console.log('Verifying config.json');

	// verify sane collection dependencies
	var cs = Object.keys(config.collections);
	
	var i = 0;
	while( i < cs.length )
	{
		var c = config.collections[cs[i]];

		if( c.initialQuery && c.sharesDataWith || !c.initialQuery && !c.sharesDataWith )
		{
			console.log('Collection "'+cs[i]+'" does not have one data source, ignoring.');
			delete config.collections[cs[i]];
			cs.splice(i,1);
		}
		else if( c.sharesDataWith && !config.collections[c.sharesDataWith] )
		{
			console.log('Dependency of "'+cs[i]+'" does not exist, ignoring.');
			delete config.collections[cs[i]];
			cs.splice(i,1);
		}
		else if( c.sharesDataWith && !config.collections[c.sharesDataWith].initialQuery )
		{
			console.log('Dependency of "'+cs[i]+'" is not independent, ignoring.');
			delete config.collections[cs[i]];
			cs.splice(i,1);
		}
		else if( c.sharesDataWith && i < cs.indexOf(c.sharesDataWith) ){
			cs.push(cs.splice(i,1));
		}
		else {
			i++;
		}
	}

	config.freshenOrder = cs;

})();


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
