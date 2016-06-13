var fs = require('fs');
var path = require('path');
var http2 = require('..');
var querystring = require("querystring");
var url = require("url");

// We cache one file to be able to do simple performance tests without waiting for the disk
var cachedFile = fs.readFileSync(path.join(__dirname, './server.js'),'utf-8');
var cachedUrl = '/server.js';

// The callback to handle requests
function onRequest(request, response) {

  var events = require('events');
  var eventEmitter = new events.EventEmitter();
	var objectUrl = url.parse(request.url);
	var objectQuery = querystring.parse(objectUrl.query);
	var pathName = objectUrl['pathname'];
	var needPush = objectQuery['push'];
  var interval;
  var messageId=1;

  console.log('request received : ' + request.url);
  //console.log(response.statusCode);

  var filename = path.join(__dirname, pathName);

  // Serving server.js from cache. Useful for microbenchmarks.
  if (request.url === cachedUrl) {
    if (response.push) {
      // Also push down the client js, since it's possible if the requester wants
      // one, they want both.
      //我是中文
      var push = response.push('/client.js');
      push.writeHead(200);
      fs.createReadStream(path.join(__dirname, '/client.js')).pipe(push);
      console.log('push client');
    }
    response.end(cachedFile);
  }

  // Reading file from disk if it exists and is safe.
  else if ((filename.indexOf(__dirname) === 0) && fs.existsSync(filename) && fs.statSync(filename).isFile()) {


    if (request.url.indexOf('/index.html')>=0 && needPush && response.push)
    {
         try{
          //实现推送
              var push = response.push('/coco.bmp');
              push.writeHead(200,{"Cache-Control":"no-cache"});
              fs.createReadStream(path.join(__dirname, '/coco.bmp')).pipe(push);

              var push2= response.push('/woo.css');
              push2.writeHead(200,{ "Cache-Control":"no-cache"});
              fs.createReadStream(path.join(__dirname, '/woo.css')).pipe(push2);
              //转发，实际文件：wooo.js
              var push3=response.push('/woo.js');
              push3.writeHead(200,{"Cache-Control":"no-cache"});
              fs.createReadStream(path.join(__dirname, '/wooo.js')).pipe(push3);

              response.writeHead(200);
              var fileStream = fs.createReadStream(filename);
              fileStream.pipe(response);
              fileStream.on('finish',response.end);
          }catch(e){console.log('\r\n2222', e, '\r\n', e.stack);}
  }else{


    response.writeHead(200);
    var fileStream = fs.createReadStream(filename);
    fileStream.pipe(response);
    fileStream.on('finish',response.end);

 
  }
  }

  // Otherwise responding with 404.
  else {

//推送数据的同时，推送消息到客户端SSE
  if (request.url == '/sse' && response.push ) {
      
        //response.write("data: " + (new Date()) + "\n\n")
      try{

        interval=setInterval(function(){

              // 先推送数据
                var msg = JSON.stringify({'msg': messageId});
                var resourcePath = '/resource/'+messageId;

                var Readable = require('stream').Readable;
                var  rs = new Readable;
                rs.push(msg);
                rs.push(null);
           
                var push4 = response.push(resourcePath);
                push4.writeHead(200);
                rs.pipe(push4);
            
              response.writeHead(200, {"Content-Type":"text/event-stream;charset:utf-8"});
              response.write('data:'+resourcePath+'\n\n');

              // 关闭其中一个浏览器会报错，未解决
                

             messageId+=1;
             }, 5000);


         }catch(e){clearInterval(interval);console.log('\r\n', e, '\r\n', e.stack);}




    }else {
      response.writeHead(404);
      response.end();
    }
    
}

}

// Creating a bunyan logger (optional)
var log = require('../test/util').createLogger('server');

// Creating the server in plain or TLS mode (TLS mode is the default)
var server;

if (process.env.HTTP2_PLAIN) {
  server = http2.raw.createServer({
    log: log
  }, onRequest);
} else {
  server = http2.createServer({
    log: log,
    key: fs.readFileSync(path.join(__dirname, '/localhost.key')),
    cert: fs.readFileSync(path.join(__dirname, '/localhost.crt'))
  }, onRequest);
}


server.listen(process.env.HTTP2_PORT || 8091);

console.log("Server running at https://127.0.0.1:8091/");