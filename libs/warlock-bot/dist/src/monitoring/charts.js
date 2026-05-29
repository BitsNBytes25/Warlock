"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartGenerator = void 0;
// Uses quickchart.io to generate a fast, open-source Chart.js image URL
const quickchart_js_1 = __importDefault(require("quickchart-js"));
class ChartGenerator {
    /**
     * Generates a URL for a time-series line graph representing player counts
     * @param labels Array of time strings (e.g., ['10:00', '10:15', '10:30'])
     * @param dataPoints Array of player counts (e.g., [10, 15, 12])
     * @param gameName The name of the game being graphed
     */
    static generatePlayerChart(labels, dataPoints, gameName) {
        const chart = new quickchart_js_1.default();
        chart.setWidth(500);
        chart.setHeight(300);
        chart.setBackgroundColor('#1E2327'); // Dark mode background for premium feel
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                        label: `${gameName.toUpperCase()} Players`,
                        data: dataPoints,
                        borderColor: '#5865F2', // Blurple
                        backgroundColor: 'rgba(88, 101, 242, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
            },
            options: {
                legend: { labels: { fontColor: '#FFFFFF' } },
                scales: {
                    xAxes: [{ ticks: { fontColor: '#FFFFFF' } }],
                    yAxes: [{ ticks: { fontColor: '#FFFFFF', beginAtZero: true } }]
                }
            }
        };
        chart.setConfig(config);
        return chart.getUrl();
    }
}
exports.ChartGenerator = ChartGenerator;
//# sourceMappingURL=charts.js.map