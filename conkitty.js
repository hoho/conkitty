/*!
 * conkitty v0.5.20, https://github.com/hoho/conkitty
 * Copyright 2013-2015 Marat Abdullin
 * Released under the MIT license
 */
'use strict';


var path = require('path'),
    ConkittyParser = require(path.join(__dirname, 'parser.js')).ConkittyParser,
    ConkittyGenerator = require(path.join(__dirname, 'generator.js')).ConkittyGenerator,
    ConkittyErrors = require(path.join(__dirname, 'errors.js')),
    fs = require('fs');

var _cache = {};


// Conkitty constructor.
function Conkitty(precompileEnv) {
    this.code = [];
    this.precompileEnv = precompileEnv;
}


Conkitty.prototype.push = function push(filename, code, base) {
    var key = JSON.stringify([filename, base]);
    if (code === undefined) { code = fs.readFileSync(filename, {encoding: 'utf8'}); }

    var cached = _cache[key];

    if (!cached || (cached.code !== code)) {
        _cache[key] = cached = {
            code: code,
            parsed: new ConkittyParser(filename, code, base, this.precompileEnv).readBlock(0) || []
        };
    }

    this.code = this.code.concat(cached.parsed);
};


Conkitty.prototype.generate = function generate(sourceMapFile, noConcatJS) {
    this.generated = (new ConkittyGenerator(this.code)).generateCode(sourceMapFile, noConcatJS);

    var includes = this.generated.includes,
        i;

    for (i in includes) {
        if (!fs.existsSync(i)) {
            throw new ConkittyErrors.IllegalName(includes[i], 'File "' + i + '" does not exist.');
        }
    }
};


Conkitty.prototype.getCommonCode = function getCommonCode() {
    return this.generated.common;
};


Conkitty.prototype.getTemplatesCode = function getTemplatesCode() {
    return this.generated.code;
};


Conkitty.prototype.getIncludes = function getIncludes() {
    return Object.keys(this.generated.includes);
};


Conkitty.prototype.getSourceMap = function getSourceMap() {
    return this.generated.map;
};

module.exports = Conkitty;
