/*!
 * conkitty v0.5.0, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';


var ConkittyParser = require(__dirname + '/parser.js').ConkittyParser,
    ConkittyGenerator = require(__dirname + '/generator.js').ConkittyGenerator;


// Conkitty constructor.
function Conkitty() {
    this.code = [];
}


Conkitty.prototype.push = function push(code) {
    code = new ConkittyParser(code);
    this.code = this.code.concat(code.readBlock(0));
};


Conkitty.prototype.compile = function compile() {
    var gen = new ConkittyGenerator(this.code);
    gen.process();
    return gen.generate();
};


module.exports = Conkitty;
