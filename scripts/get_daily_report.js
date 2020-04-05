const config = require("config");
const superagent = require("superagent");

console.log(config.get("influxdb"));

const TOKEN = config.get("slack.token");
const CHANNEL_ID = config.get("slack.cid");
const THREAD_ID = config.get("slack.ts");

const influxdb = new influx.InfluxDB({
    host: config.get("influxdb.host"),
    port: config.get("influxdb.port"),
    database: config.get("influxdb.database"),
    pool: config.get("influxdb.pool"),
    schema: [
        {
            measurement: 'DailyReport',
            fields: {
                issuekey: influx.FieldType.STRING,
                status: influx.FieldType.INTEGER,
                description: influx.FieldType.STRING
            },
            tags: [
                'username',
                'name',
                'team',
                'project',
                'issuetype',
                'priority'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});

function getDailyReport(TOKEN, CHANNEL_ID, THREAD_ID) {
    superagent
  .get('https://slack.com/api/conversations.replies')
  .query({ token: TOKEN, channel: CHANNEL_ID, ts: THREAD_ID }) // query string
  .set('accept', 'json')
  .end((err, res) => {
    // Calling the end function will send the request
  });
}