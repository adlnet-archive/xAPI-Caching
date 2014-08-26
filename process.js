/*
 * Processing functions
 */

var request = require('request'),
	zlib = require('zlib'),
	libfs = require('fs'),
	libpath = require('path'),
	liburl = require('url'),

	config = require('./config.json'),
	XAPICollection = require('./xapicollection.js').CollectionSync;


var digest = {};


function intervalRefresh(done)
{
	var i = 0;

	function genCb(){
		if(i<config.refreshOrder.length)
			refresh(config.refreshOrder[i++], null, null, genCb);
		else if(done)
			done();
	}

	genCb();
}


function refresh(collectId, req,res,next)
{
	// create data directory if it doesn't exist
	try {
		libfs.mkdirSync( libpath.join(__dirname, 'data') );
		console.log('Creating data directory');
	}
	catch(e){}

	console.log('Refreshing', collectId);
	var collectConfig = config.collections[collectId];


	// load cached statements
	var json = '';

	var cacheId = collectConfig.sharesDataWith ? collectConfig.sharesDataWith : collectId;
	var gzCache = libfs.createReadStream( libpath.join(__dirname, 'data', cacheId+'.json.gz') );
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
		}
		catch(e){
			console.log('No previous data for '+collectId+', starting fresh.');
			statements = [];
		}

		if( collectConfig.initialQuery )
		{
			// get timestamp of last known statement
			var since;
			if( statements.length > 0 )
				since = statements[statements.length-1].stored;

			// build request options
			var qs = {'since': since, 'ascending': true};
			for(var i in collectConfig.initialQuery){
				qs[i] = collectConfig.initialQuery[i];
			}

			var options = {
				'method': 'GET',
				'url': liburl.resolve(config.lrs.endpoint, 'statements'),
				'headers': {'X-Experience-API-Version': '1.0.1'},
				'qs': qs
			};

			if(config.lrs.username && config.lrs.password)
				options.auth = {'user': config.lrs.username, 'pass': config.lrs.password};

			// make the request to the LRS
			request(options, requestCb);
		}
		else {
			processStatements();
		}
	}

	
	function requestCb(err,resp,body)
	{
		// fail on error
		if(err){
			console.log('Error retrieving from LRS', err);
			processStatements();
		}
		else {
			// parse response, save out statements
			var newData = JSON.parse(body);
			console.log('Statements retrieved from LRS:', newData.statements.length);
			Array.prototype.push.apply(statements, newData.statements);

			// get next page of statements if available
			if(newData.more){
				request.get(
					liburl.resolve(config.lrs.endpoint, newData.more),
					{'headers': {'X-Experience-API-Version':'1.0.1'}},
					requestCb
				);
			}
			else {
				saveNewStatements();
			}
		}
	}


	function saveNewStatements()
	{
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
			output.end()
			processStatements();
		});

	}

	function processStatements()
	{
		// process statements using the xAPI Collection class
		var collection = new XAPICollection(statements);

		// loop over commands in config file and apply
		try
		{
			var commands = config.collections[collectId].commands;
			for( var i=0; i<commands.length; i++ ){
				collection = collection[commands[i][0]].apply(collection, commands[i].slice(1));
			}
			digest[collectId] = collection.contents;
		}
		catch(e){
			console.log('Error while processing statements', e);
		}

		// respond with processed statements and we're done!
		if(res)
			res.status(200).send();
		else if(next)
			next();
	}

}


function serveResults(collectId, req,res)
{
	if(digest[collectId])
		res.send(digest[collectId]);
	else
		next();
}


exports.intervalRefresh = intervalRefresh;
exports.refresh = refresh;
exports.serveResults = serveResults;

