Module.register("MMM-Radarr", {
    defaults: {
        apiKey: "",
        baseUrl: "http://localhost:8989",
        upcomingLimit: 5,
        historyLimit: 5,
        updateInterval: 15 * 60 * 1000, // 15 minutes
        
    },

    start: function() {
        this.upcoming = [];
        this.history = [];
        this.sendSocketNotification("START_RADARR", this.config);
    },

    getStyles: function() {
        return ["MMM-Radarr.css"];
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "radarr-wrapper";

        const upcomingSection = this.createSection("Upcoming Movies", this.upcoming);
        const historySection = this.createSection("Recently Downloaded", this.history);

        wrapper.appendChild(upcomingSection);
        wrapper.appendChild(historySection);

        return wrapper;
    },

    createSection: function(title, data) {
        const section = document.createElement("div");
        section.className = "radarr-section";

        const header = document.createElement("h2");
        header.textContent = title;
        section.appendChild(header);

        const list = document.createElement("ul");
        data.forEach(item => {
            const listItem = document.createElement("li");
            if (title === "Upcoming Movies") {
                const date = new Date(item.start);
                listItem.textContent = `${item.title}`;
            } else {
                listItem.textContent = `${item.movie.title} (${item.movie.year})`;
            }
            list.appendChild(listItem);
        });

        section.appendChild(list);
        return section;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "RADARR_UPCOMING") {
            this.upcoming = payload;
            this.updateDom();
        } else if (notification === "RADARR_HISTORY") {
            this.history = payload;
            this.updateDom();
        }
    },
});
