/*!
 * conkitty v0.5.0, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';


var ConkittyParser = require(__dirname + '/parser.js').ConkittyParser,
    ConkittyGenerator = require(__dirname + '/generator.js').ConkittyGenerator,
    ConkittyErrors = require(__dirname + '/errors.js'),
    fs = require('fs');


// Conkitty constructor.
function Conkitty() {
    this.code = [];
}


Conkitty.prototype.push = function push(code, base) {
    if (!code) { return; }
    code = new ConkittyParser(code, base);
    this.code = this.code.concat(code.readBlock(0));
};


Conkitty.prototype.generate = function generate() {
    this.generated = (new ConkittyGenerator(this.code)).generateCode();

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

module.exports = Conkitty;
