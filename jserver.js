var http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs'),
    cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var cache = {};

//var STATICROOT = '/usr/local/www/html/test/';
var STATICROOT = '/usr/local/www/hornbill/web/';
var RESEXPIRE = 3000;
function onErr (filepath ,res){
   res.writeHead( 404 ,{'Content-Type' : 'text/plain'}); 
   res.write( filepath + ' is lost');
   res.end();

    }
/*
*load js file from cache or io
*TODO uglify js file
*/
function loadFile(filepath , res , onReady) {
    filepath = STATICROOT + filepath.replace(/\.\.\//g,'');
    if ('.js' != filepath.substr(-3)) {
        filepath = filepath + '.js';
        }
    if (cache.hasOwnProperty(filepath) ){
        res.write(cache[filepath] ,'binary');
        onReady();
        return;
        }
    path.exists ( filepath , function (exists) {
        if (!exists ) {
            onErr (filepath ,res);
            return;
        }
        fs.readFile (filepath , 'binary' , function (err ,file) {
            if (err) {
                onErr (filepath ,res);
                return;
            }
            cache[filepath] = file + ';';
            res.write( file , 'binary');
			res.write(';');
            onReady();
            });
        });
    }
 /*
 *load a,b in  sequence ,
 * a+b in  parallel
 */   
function loadFileSeq(fileBlocks ,res , onReady){
    var timer = setTimeout ( function() {
        res.end();
        } , RESEXPIRE);
    fileBlocks = fileBlocks.split(',');
    var fsnum = fileBlocks.length;
    var onAllReady = function(){
           res.end();
           clearTimeout(timer);
        }

    var onSecFinish =function(){
         if ( fileBlocks.length ) {
             loadFileParal (fileBlocks.shift() , res , onSecFinish);   
          }else{
              onAllReady();
              } 
        }
    loadFileParal (fileBlocks.shift() , res , onSecFinish);
        
    
    }
function loadFileParal(fileBlocks , res , onReady) {
    if (!fileBlocks) return;
    var blocks = fileBlocks.split('+');
    var blockNum = blocks.length;
    var onSecFinish = function(){
        if (--blockNum <= 0 ){
            onReady();
            }
        }
    blocks.forEach(function(filePath){
         loadFile (filePath , res , onSecFinish);
        
        });

    
    }    
/*
*combo require files 
*/
function onRequest(req , res){

    var statfs = url.parse(req.url).pathname;
    if ('~' == statfs[1] ){ statfs = statfs.substr(2 ); }
    loadFileSeq (statfs , res );

    }
if (cluster.isMaster ){
    while ( numCPUs--){    
        cluster.fork();
        };
    cluster.on('death' , function(worker) {
        cluster.fork();
        });
    
 }else {
	var arguments = process.argv.splice(2);
	//console.log(arguments);
	STATICROOT += (arguments[1]||'script') + '/' ;
    http.createServer(onRequest).listen(isNaN(arguments[0]-0) ? 8080: arguments[0] );
   //http://nodemanual.org/0.6.10/nodejs_ref_guide/cluster.html
   //process.send({ args: arguments });
   // work = cluster.fork();
   //work.on('message' ,...)
  }
