module.exports = {
	"port": 3003,
	"refreshInterval": "3 hours",

	"lrs": {
		"endpoint": "https://lrs.adlnet.gov/xAPI/",
		"comment": "Can use 'username' and 'password' keys here too"
	},

	"collections": {
		"verbFrequency": {
			"initialQuery": {},
			"commands": [
				["groupBy", "verb.id"],
				["count"],
				["select", "group as in, count as out, sample.verb.display.en-US as label"],
				["orderBy", "out", "desc"]
			],
			"manualRefresh": true
		},
		"lrsActivity": {
			"sharesDataWith": "verbFrequency",
			"commands": function(c){
				var lastMonth = new Date(Date.now()-1000*60*60*24*30);
				return c
					.groupBy('stored', [lastMonth.toISOString(),(new Date()).toISOString(), 1000*60*60*24])
					.count()
					.select('groupStart, groupEnd, count as stmtCount')
					.orderBy('groupStart');
			},
			"manualRefresh": true
		},
		"rawData": {
			"sharesDataWith": "verbFrequency",
			"commands": []
		}
	}
};
