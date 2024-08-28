const NodeHelper = require("node_helper");
const https = require("https");
const http = require("http");
const url = require("url");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "START_RADARR") {
            this.config = payload;
            this.getUpcoming();
            this.getHistory();
            this.scheduleUpdate();
        }
    },

    scheduleUpdate: function() {
        setInterval(() => {
            this.getUpcoming();
            this.getHistory();
        }, this.config.updateInterval);
    },

    getUpcoming: function() {
        const apiUrl = `${this.config.baseUrl}/api/v3/calendar`;
        const today = new Date();
        const futureDate = new Date(today.getTime() + (200 * 24 * 60 * 60 * 1000)); // 200 days in the future
        
        const params = new URLSearchParams({
            start: today.toISOString(),
            end: futureDate.toISOString(),
            unmonitored: false,
        });

        this.sendRequest(apiUrl, params, (response) => {
            const upcoming = response
                
                // .filter(event => event.hasFile === false)
                .map(event => ({
                    title: event.title,
                    start: event.digitalRelease || event.inCinemas,
                }));
            this.sendSocketNotification("RADARR_UPCOMING", upcoming);
        });
    },

    getHistory: function() {
        const apiUrl = `${this.config.baseUrl}/api/v3/history`;
        const params = new URLSearchParams({
            page: 1,
            pageSize: this.config.historyLimit,
            sortKey: "date",
            sortDirection: "descending",
            includeMovie: true,
            eventType: 1,
        });

        this.sendRequest(apiUrl, params, (response) => {
            this.sendSocketNotification("RADARR_HISTORY", response.records);
        });
    },

    sendRequest: function(apiUrl, params, callback) {
        const fullUrl = `${apiUrl}?${params.toString()}`;
        const parsedUrl = url.parse(fullUrl);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                "X-Api-Key": this.config.apiKey,
            },
        };

        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const req = protocol.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    callback(jsonData);
                } catch (error) {
                    console.error("Error parsing JSON:", error);
                }
            });
        });

        req.on('error', (error) => {
            console.error("Error fetching Radarr data:", error);
        });

        req.end();
    },
});
