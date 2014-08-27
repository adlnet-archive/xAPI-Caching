/*
 * Main server router
 */

var http = require('http'),
	express = require('express'),
	morgan = require('morgan'),
	moment = require('moment'),
	compression = require('compression'),
	cors = require('cors'),
	
	config = require('./config.js'),
	process = require('./process.js');


(function checkConfigSanity()
{
	console.log('Verifying config.json');

	// verify sane collection dependencies
	var cs = Object.keys(config.collections);
	
	var refreshable = true;
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
			refreshable |= c.manualRefresh;
			i++;
		}
	}

	config.refreshOrder = cs;
	config.globalRefresh = refreshable;

})();

process.intervalRefresh(function()
{
	var app = express();

	app.use(compression());
	app.use(morgan('combined'));
	app.use(cors());

	app.post('/:collectId/refresh', function(req,res,next)
	{
		if( config.collections[req.params.collectId] )
		{
			if(config.collections[req.params.collectId].manualRefresh === true)
				process.refresh(req.params.collectId, req,res);
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

	app.post('/refresh', function(req,res,next)
	{
		if(config.globalRefresh){
			process.intervalRefresh(function(){
				res.status(200).send();
			});
		}
		else
			next();
	});

	app.get('/', function(req,res,next){
		res.send(Object.keys(config.collections));
	});

	// all else fails, 404
	app.use(function(req,res){
		res.status(404).send('<h1>404 Not Found</h1>');
	});

	if(config.refreshInterval){
		var timeparts = config.refreshInterval.split(' ');
		var interval = moment.duration(parseInt(timeparts[0]), timeparts[1]);
		setInterval(process.intervalRefresh, interval.asMilliseconds());
		console.log('Setting automatic cache refresh in '+interval.humanize());
	}

	http.createServer(app).listen(config.port);
	console.log('Listening on port '+config.port);

});
