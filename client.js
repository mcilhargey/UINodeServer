// =============================================================================
// INCLUDES
var express  = require('express'),
    app      = express(),
    server   = require("http").createServer(app),
    io       = require('socket.io')(server),
    fs       = require("fs"),
    net      = require('net');

// =============================================================================
// CONSTANTS
var args = require('minimist')(process.argv.slice(2));

if (args.h || args.help) {
    var msg = "Usage: \n"
            + "node client.js <args>\n\n"
            + "Optional arguments: (default value)\n"
            + "--host=hostname (127.0.0.1)\n"
            + "    This is the hostname for the game server\n"
            + "--port=port# (17428)\n"
            + "    This is the port number for the game's ui server\n"
            + "--uiport=UIPort# (8080)\n"
            + "    This is the port # on this machine for the UI\n"
    console.log(msg);
    process.exit();
}

var HOST = args.host ? (args.host + "") : "127.0.0.1";
var PORT = args.port ? parseInt(args.port, 10) : 17428;
var SERVER_PORT = args.uiport ? parseInt(args.uiport, 10) : 8080;
var USER_NAME = 'alpha';
var PASSWORD = 'sapphire';
var FRAME_RATE = 100;
var UPDATE_INTERVAL = Math.floor(1 / FRAME_RATE * 1000);
var config; 
var numConnections = 0;
var frame = false;

// =============================================================================
// STATUS
var intervalToken;

// =============================================================================
// APP

// This line tells the app framework to search the path ./client_page/ when
// looking at relative paths
app.use(express.static(__dirname + '/client_page/'));

// This line tells the app framework that when navigating to localhost:8080/, 
// use this response function
app.get('/', function(req, res){
    // Read the simpleui2.html file. Once the file is read, call the function
    fs.readFile('client_page/clientUI.html',
        function (err, contents) {
            // If we have an error, then send back a 500 server error and write
            // a short message.
            if (err) {
                res.writeHead(500);
                return res.end('Error loading clientUI.html');
            }
            // If we were successful, tell the browser it's html and send it forward.
            res.writeHead(200, {'Content Type': 'text/html'});
            res.end(contents);
    });
    
});

// -----------------------------------------------------------------------------
// SERVER

// tell the server to listen on the port 8080
server.listen(8080);


// =============================================================================
// HELPER FUNCTIONS
function shutDown() {
    clearInterval(intervalToken);
    client.end();
}

function handleFrame() {
    if (frame) { return; }
    frame = true;
    client.write("FRAME\n");
}

// =============================================================================
// CLIENT
var client = net.connect({port: PORT, host: HOST},
    function () {
        console.log("connected to the server!");
        client.write(USER_NAME + ' ' + PASSWORD + '\n');
    }
);
client.setEncoding("ascii");
var dataBuf = "";
client.on('data', function (data) {
    frame = false;
    dataBuf += data.replace(/(\r\n|\n|\r)/gm, "");
    dataBuf = dataBuf.replace("}{\"STATUS\"", "}\n{\"STATUS\""); 
    //console.log(dataBuf)
    if (dataBuf.indexOf('\n',1) >= 0 ) {
	var index = dataBuf.indexOf('\n',1);
	var message = dataBuf.substr(0, index);
	dataBuf = dataBuf.substr(index, dataBuf.length-index);
        try {
            var dataObj   = JSON.parse(message);
            var innerData = JSON.parse(dataObj.DATA);
            if (innerData.config) {
                config = innerData;
                io.emit("config", innerData);
            }
            if (innerData.frame) {
                if (innerData.frame === "reset") {
                    io.emit("resetgame");
                }
                else {
                    io.emit("frame", innerData.frame);
                }
            }
            if (global && global.gc) {
                global.gc();
            }
        }
        catch (err) {
            console.log("Bad frame recieved", err);
            console.log(message);
        }
    }
});

client.on('end', function () {
    console.log('disconnected from the server');
    shutDown();
});

process.on('uncaughtException', function (err) {
    console.log(err);
});

// -----------------------------------------------------------------------------
// SOCKET.IO
// When the client side script connects a socket, call the function
io.on('connection', function (socket) {
    socket.on("StartFrames", function () {
	if (numConnections >= 0) {
            intervalToken = setInterval(handleFrame, UPDATE_INTERVAL);
        }
        numConnections++;
        console.log(numConnections + " Connected");
    });
    socket.on("disconnect", function (data) {
        numConnections--;

        if (numConnections < 0) {
            numConnections = 0;
        }
        if (numConnections === 0) {
            clearInterval(intervalToken);
        }
        console.log("Disconnected");
    });
    if (config) {
        socket.emit("config", config);
    }
    else {
        client.write("CONFIG\n");
    }  
});
