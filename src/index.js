'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');

var glob = require('glob');
var Spider = require('./spider.js');
var Optimizer = require('./optimizer.js');
var Convertor = require('./convertor.js');



var copyFile = function (srcpath, destpath) {
	var contents = fs.readFileSync(srcpath);
	fs.writeFileSync(destpath, contents);
};



var FontSpider = function (src, options) {

	if (typeof src === 'string') {
		src = glob.sync(src);
	} else {
		var srcs = [];
		src.forEach(function (item) {
			srcs = srcs.concat(glob.sync(item));
		});
		src = srcs;
	}

	options = options || {};
	
	this.src = src;
	this.options = options;
};


FontSpider.prototype = {

	constructor: FontSpider,

	onoutput: function (data) {},
	onerror: function (data) {},
	onend: function (data) {},


	start: function () {

		var that = this;
		var src = this.src;
		var options = this.options;

		var debug = options.debug;
		var ignore = options.ignore;
		var chars = options.chars;
		var backup = options.backup !== false;

		var BACKUP_EXTNAME = '.backup';


		new Spider(src, function (error, data) {

			if (error) {
				throw error;
			}

			var result = [];

			data.forEach(function (item) {

		        // 忽略的字体
		        if (ignore && ignore.indexOf(item.name) !== -1) {
		            return;
		        }

		        var includeChars = '';
		        var chars = item.chars;

		        
		        if (typeof chars === 'string') {
		            includeChars = chars;
		        } else if (typeof chars === 'object') {
		            includeChars = chars[item.name];
		        }


		        // 除重
		        includeChars.split('').forEach(function (char) {
		            if (item.chars.indexOf(char) === -1) {
		                chars += char;
		            }
		        });


		        // 如果没有使用任何字符，则不处理字体
		        if (!chars) {
		        	return;
		        }


		        // 找到 .ttf 的字体文件
		        var src, dest;
		        item.files.forEach(function (file) {
		            var extname = path.extname(file).toLocaleLowerCase();
		            
			        if (error) {
			        	return;
			        }

		            if (extname !== '.ttf') {
		            	return;
		            }

	            	if (fs.existsSync(file)) { 
		            	
		            	if (backup && fs.existsSync(file + BACKUP_EXTNAME)) {
		            		// 使用备份的字体
		            		src = file + BACKUP_EXTNAME;
		            	} else {
		            		src = file;
		            		// 备份字体，这样可以反复处理
		            		backup && copyFile(src, src + BACKUP_EXTNAME);
		            	}

		            	dest = file;
	            	} else {

		            	error = {
		            		code: 1,
		            		message: '"' + file + '" file not found.'
		            	};
		            	that.onerror(error);
		            }
		            
		            
		        });


		        if (error) {
		        	return;
		        }


		        if (!src) {
	            	error = {
	            		code: 2,
	            		message: '".ttf" file not found.'
	            	};
	            	that.onerror(error);
		            return;
		        }


	            dest = dest || src;
	            var dirname = path.dirname(dest);
	            var extname = path.extname(dest);
	            var basename = path.basename(dest, extname);
	            var out = path.join(dirname, basename);
	            var stat = fs.statSync(src);

	            

	            var optimizer = new Optimizer(src);
	            var optimizerResult = optimizer.minify(dest, chars);
	            

	            if (optimizerResult.code !== 0) {

	            	if (optimizerResult.code === Optimizer.COMMAND_NOT_FOUND) {
		            	error = {
		            		code: 3,
		            		message: 'Please install perl. See: http://www.perl.org'
		            	};
	            	} else {
		            	error = {
		            		code: 4,
		            		message: 'Optimizer error.\n' + src,
		            		result: optimizerResult.output
		            	};
	            	}

	            	that.onerror(error);

	            	return;
	            }

	            var info = {
	            	fontName: item.name,
	            	includeChars: chars.replace(/[\n\r\t]/g, ''),
	            	originalSize: stat.size,
	            	output: [{
	            		file: path.relative('./', dest),
	            		size: fs.statSync(dest).size
	            	}]
	            };

	            var convertor = new Convertor(dest);

	            item.files.forEach(function (file) {
	                
	                var extname = path.extname(file).toLocaleLowerCase();
	                var type = extname.replace('.', '');

	                if (type === 'ttf') {
	                    return;
	                }
	                
	                if (typeof convertor[type] === 'function') {
	                    convertor[type](file);

	                    info.output.push({
	                    	file: path.relative('./', file),
	                    	size: fs.statSync(file).size
	                    });

	                } else {
		            	console.warn('File ' + path.relative('./', file) + ' not created.')
	                }
	                
	            });


	            result.push(info);
	            that.onoutput(info);

			});

			
			that.onend(result);


		}, debug);

	}
};


module.exports = FontSpider;
