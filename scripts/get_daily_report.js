const config = require("config");
const superagent = require("superagent");
const influx = require("influx");
const _ = require("lodash");


const TOKEN = config.get("slack.token");
const CHANNEL_ID = config.get("slack.cid");
const THREAD_ID = config.get("slack.ts");
const members = config.get("members");
const influxdb = new influx.InfluxDB({
    host: config.get("influxdb.host"),
    port: config.get("influxdb.port"),
    database: config.get("influxdb.database"),
    pool: config.get("influxdb.pool"),
    schema: [
        {
            measurement: 'DailyReport',
            fields: {
                status: influx.FieldType.STRING,
                description: influx.FieldType.STRING,
                key: influx.FieldType.STRING,
                url: influx.FieldType.STRING
            },
            tags: [
                'type',
                'username',
                'name',
                'team'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});

function getDailyReport(TOKEN, CHANNEL_ID, THREAD_ID) {
    superagent
  .get('https://slack.com/api/conversations.replies')
  .query({ token: TOKEN, channel: CHANNEL_ID, ts: THREAD_ID, limit: 50 }) // query string
  .set('accept', 'json')
  .end((err, res) => {
    const body = _.get(res, 'body', null);
    if (body && body.ok) {
        parseResponse(body);
    } else {
        console.log("NO RESPONSE");
        console.log(body);
    }
  });
}
function parseResponse(body){
    const messages = body.messages || [];
    let series = [];
    messages.forEach(function(msg) {
        let member = _.find(members, function(o) { return o.slackId === msg.user; });
        if (member) {
            let elements = _.get(msg, 'blocks[0].elements[0].elements', []);
            let timestamp = _.get(msg, 'ts', '');
            timestamp = parseInt(timestamp.split(".")[0]+"000");
            series = _.union(series, getItem(timestamp, member, elements));
        }
    })
    influxdb.writeMeasurement('DailyReport', series, { database: 'jira', precision: 'ms' }).then(result => {
        console.log("result :", result);
    }).catch(error => {
        console.error("Error :", error, "Stack:", error.stack)
    });
}
function getItem(timestamp, member, elements) {
    console.log("getItem", member)
    var rs = [];
    var temp = {
        measurement: 'DailyReport',
        fields: {
            status: 'InProgress',
            description: '',
            key: '',
            url: ''
        },
        tags: {
            type: 1,
            username: member.username,
            name: member.name,
            team: member.team
        },
        timestamp: timestamp++
    }
    while(elements.length) {
        item = elements.shift();
        if (temp.fields.description && item.type === 'emoji' && (item.name === "rose" || item.name === "rocket" || item.name === "cactus")) {
            rs.push(temp);
            temp = {
                measurement: 'DailyReport',
                fields: {
                    status: 'InProgress',
                    description: '',
                    key: '',
                    url: ''
                },
                tags: {
                    type: 1,
                    username: member.username,
                    name: member.name,
                    team: member.team
                },
                timestamp: timestamp++
            }
        }
        if (item.type === 'emoji' && item.name === "rose") {
            temp.fields.type = 1;
        }
        if (item.type === 'emoji' && item.name === "rocket") {
            temp.fields.type = 2;
        }
        if (item.type === 'emoji' && item.name === "cactus") {
            temp.fields.type = 3;
        }
        if (item.type === 'link') {
            temp.fields.key = item.text;
            temp.fields.url = item.url
        }
        if (item.type === "text") {
            item.text = _.trim(item.text);
        }
        if (item.type === "text" && item.text) {
            temp.fields.description = item.text;
        }
        if (item.type === 'emoji' && (item.name === "done" || item.name === "white_check_mark" || item.name === "heavy_check_mark")) {
            temp.fields.status = "Done";
        }
    }
    if (temp.fields.description) {
        rs.push(temp);
    }
    return rs;
}
getDailyReport(TOKEN, CHANNEL_ID, THREAD_ID);