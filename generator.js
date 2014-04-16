/*!
 * conkitty, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';

var ConkittyTypes = require(__dirname + '/types.js'),
    ConkittyErrors = require(__dirname + '/errors.js');


function conkittyMatch(value, pattern) {
    if (value.length && !pattern.length) {
        return value[0];
    }

    if (!value.length && pattern.length) {
        for (var i = 0; i < pattern.length; i++) {
            if (pattern[i].count !== '*') { return pattern[i]; }
        }
        return;
    }

    switch (pattern[0].match(value[0])) {
        case 'stay':
            return conkittyMatch(value.slice(1), pattern);

        case 'next':
            return conkittyMatch(value.slice(1), pattern.slice(1));

        case 'both':
            if (!conkittyMatch(value.slice(1), pattern)) { return; }
            return conkittyMatch(value.slice(1), pattern.slice(1));

        default:
            return value[0];
    }
}


function ConkittyPatternPart(parts, count) {
    this.count = count;
    this.candidates = {};
    this.src = parts[0].src;
    this.lineAt = parts[parts.length - 1].lineAt;
    this.charAt = parts[parts.length - 1].charAt + 1;

    for (var i = 2; i < arguments.length; i += 2) {
        this.candidates[arguments[i]] = arguments[i + 1];
    }
}


ConkittyPatternPart.prototype.match = function match(part) {
    var m = this.candidates[part.type],
        ret;

    if (m === null || (m && m === part.value)) {
        if (this.count === '*') {
            ret = 'both';
        } else {
            this.count--;
            ret = this.count > 0 ? 'stay' : 'next';
        }
    } else {
        ret = false;
    }

    return ret;
};


function ConkittyGenerator(code) {
    this.code = code;
    this.deps = {};
    this.tpls = {};
}


ConkittyGenerator.prototype.process = function process() {
    for (var i = 0; i < this.code.length; i++) {
        this.processTemplate(this.code[i]);
    }
};


ConkittyGenerator.prototype.generate = function generate() {

};


ConkittyGenerator.prototype.processTemplate = function processTemplate(tree) {
    var error,
        pattern = [
            new ConkittyPatternPart(tree.value, 1, ConkittyTypes.TEMPLATE_NAME, null),
            new ConkittyPatternPart(tree.value, '*', ConkittyTypes.ARGUMENT_DECL, null)
        ];

    error = conkittyMatch(tree.value, pattern);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    var name = tree.value[0].value;

    if (name in this.tpls) {
        throw new ConkittyErrors.DuplicateDecl(tree.value[0]);
    }

    this.tpls[name] = {
        getCodeBefore: function getCodeBefore() {

        },

        getCodeAfter: function getCodeAfter() {

        }
    };
};


ConkittyGenerator.prototype.processCall = function processCall() {
    /*var pattern = [
     new ConkittyPatternPart(1, ConkittyTypes.COMMAND_NAME, 'CALL'),

     new ConkittyPatternPart(1, ConkittyTypes.TEMPLATE_NAME, null,
     ConkittyTypes.JAVASCRIPT, null,
     ConkittyTypes.VARIABLE, null),

     new ConkittyPatternPart('*', ConkittyTypes.VARIABLE, null,
     ConkittyTypes.JAVASCRIPT, null,
     ConkittyTypes.STRING, null,
     ConkittyTypes.COMMAND_NAME, 'PAYLOAD')
     ];*/
};


module.exports.ConkittyGenerator = ConkittyGenerator;
module.exports.ConkittyPatternPart = ConkittyPatternPart;
