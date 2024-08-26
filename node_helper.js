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
        const apiUrl = `${this.config.baseUrl}/feed/v3/calendar/radarr.ics`;
        const params = new URLSearchParams({
            pastDays: 0,
            futureDays: 200,
            unmonitored: false,
        });

        this.sendRequest(apiUrl, params, (response) => {
            const events = this.parseICS(response);
            const upcoming = events
                .filter(event => event.title.toLowerCase().includes('digital release'))
                .sort((a, b) => a.start - b.start)
                .slice(0, this.config.upcomingLimit);
            this.sendSocketNotification("RADARR_UPCOMING", upcoming);
        }, true);
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

    sendRequest: function(apiUrl, params, callback, raw = false) {
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
                if (raw) {
                    callback(data);
                } else {
                    try {
                        const jsonData = JSON.parse(data);
                        callback(jsonData);
                    } catch (error) {
                        console.error("Error parsing JSON:", error);
                    }
                }
            });
        });

        req.on('error', (error) => {
            console.error("Error fetching Radarr data:", error);
        });

        req.end();
    },

    parseICS: function(icsData) {
        const lines = icsData.split('\n');
        const events = [];
        let currentEvent = null;

        for (let line of lines) {
            line = line.trim();

            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT') {
                if (currentEvent) {
                    events.push(currentEvent);
                    currentEvent = null;
                }
            } else if (currentEvent) {
                const [key, value] = line.split(':');
                switch (key) {
                    case 'SUMMARY':
                        currentEvent.title = value;
                        break;
                    case 'DTSTART':
                        currentEvent.start = new Date(value);
                        break;
                    case 'DESCRIPTION':
                        currentEvent.description = value;
                        break;
                }
            }
        }

        return events;
    }
});
