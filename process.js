/*
 * Processing functions
 */

var request = require('request'),
	moment = require('moment'),
	zlib = require('zlib'),
	libfs = require('fs'),
	libpath = require('path'),
	liburl = require('url'),

	config = require('./config.json');


var digest = {};


exports.freshen = function(collectId, req,res)
{
	console.log('Freshening', collectId);

	// create data directory if it doesn't exist
	try {
		libfs.mkdirSync( libpath.join(__dirname, 'data') );
		console.log('Creating data directory');
	}
	catch(e){}

	// load cached statements
	var json = '';

	var gzCache = libfs.createReadStream( libpath.join(__dirname, 'data', collectId+'.json.gz') );
	gzCache.on('error', function(err){
		console.log('Error opening file');
		handleFileJsonData();
	});
	var cache = gzCache.pipe(zlib.createGunzip());
	cache.setEncoding('utf8');
	cache.on('error', function(){
		console.log('Error unzipping file');
		handleFileJsonData();
	})
	.on('data', function(chunk){
		json += chunk;
	})
	.on('end', handleFileJsonData);


	var statements = null;

	function handleFileJsonData()
	{
		// parse cached statements if present
		try {
			statements = JSON.parse(json);
			console.log(statements.length, 'statements retrieved from cache');
		}
		catch(e){
			console.log('No previous data for '+collectId+', starting fresh.');
			statements = [];
		}

		// get timestamp of last known statement
		var since;
		if( statements.length > 0 )
			since = statements[statements.length-1].stored;

		// build request options
		var qs = {'since': since, 'ascending': true};
		for(var i in config.collections[collectId].initialQuery){
			qs[i] = config.collections[collectId].initialQuery[i];
		}

		var options = {
			'method': 'GET',
			'url': liburl.resolve(config.lrs.endpoint, 'statements'),
			'headers': {'X-Experience-API-Version': '1.0.1'},
			'qs': qs
		};

		if(config.lrs.username && config.lrs.password)
			options.auth = {'user': config.lrs.username, 'pass': config.lrs.password};

		console.log(options);

		// make the request to the LRS
		request(options, requestCb);
	}

	
	function requestCb(err,resp,body)
	{
		if(err){
			console.log(err);
			res.status(500).send(err);
			return;
		}
		else {
			var newData = JSON.parse(body);
			console.log('Statements retrieved:', newData.statements.length);
			console.log('More url:', newData.more);

			Array.prototype.push.apply(statements, newData.statements);

			if(newData.more){
				request.get(
					liburl.resolve(config.lrs.endpoint, newData.more),
					{'headers': {'X-Experience-API-Version':'1.0.1'}},
					requestCb
				);
			}
			else {
				processStatements();
			}
		}
	}


	function processStatements()
	{
		console.log(statements.length, 'statements retrieved');

		// compress and save new statement cache
		var output = zlib.createGzip();
		output.on('error', function(err){
			console.log('Error compressing cache', err);
		});
		var gzOutput = libfs.createWriteStream( libpath.join(__dirname, 'data', collectId+'.json.gz') );
		gzOutput.on('error', function(err){
			console.log('Error writing cache to file', err);
		});
		output.pipe(gzOutput);
		output.write(JSON.stringify(statements), 'utf8', function(){
			statements = null;
			output.end()
		});

		

		res.status(200).send();
	}

};


exports.serveResults = function(collectId, req,res)
{
	res.status(200).send('Page for '+collectId);
};
