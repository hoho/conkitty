/*!
 * conkitty v0.5.0, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
module.exports = (function() {
    'use strict';

    // Conkitty constructor.
    function Conkitty() {
        this.code = [];
    }

    var uglify = require('uglify-js'),
        jsParser = uglify.parser,
        jsUglify = uglify.uglify,

        CONKITTY_TYPE_VARIABLE = 'variable',
        CONKITTY_TYPE_JAVASCRIPT = 'JavaScript',
        CONKITTY_TYPE_STRING = 'string',
        CONKITTY_TYPE_TEMPLATE_NAME = 'template name',
        CONKITTY_TYPE_COMMAND_NAME = 'command name',
        CONKITTY_TYPE_CSS = 'css selector',
        CONKITTY_TYPE_CSS_TAG = 'tag name',
        CONKITTY_TYPE_CSS_CLASS = 'css class name',
        CONKITTY_TYPE_CSS_ID = 'css id',
        CONKITTY_TYPE_CSS_BEM = 'css BEM name',
        CONKITTY_TYPE_CSS_BEM_MOD = 'css BEM modifier',
        CONKITTY_TYPE_CSS_ATTR = 'css attribute',
        CONKITTY_TYPE_CSS_ATTR_NAME = 'css attribute name',
        CONKITTY_TYPE_CSS_IF = 'css conditional',
        CONKITTY_TYPE_ATTR = 'attribute',
        CONKITTY_TYPE_INCLUDE = 'file include',

        whitespace = /[\x20\t\r\n\f]/,

        variableStopExpr = /[^a-zA-Z0-9_]/,
        variableCheckExpr = /^[a-zA-Z_][a-zA-Z0-9_]*$/,
        cssStopExpr = /[^a-zA-Z0-9_-]/,
        cssNameCheckExpr = /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        tagCheckExpr = /^[a-z][a-zA-Z0-9_-]*$/,
        bemStopExpr = /[^a-zA-Z0-9-]/,
        bemCheckExpr = /^[a-zA-Z][a-zA-Z0-9-]*$/;

    function clearComments(code) {
        var i,
            j,
            k,
            line,
            inComment,
            inString;

        i = 0;
        while (i < code.length) {
            line = code[i];

            if (!inComment) {
                inString = false;
                j = 0;

                while (j < line.length) {
                    if (line[j] === "'" || line[j] === '"') {
                        if (inString === line[j] && line[j - 1] !== '\\') {
                            inString = false;
                            j++;
                            continue;
                        } else if (!inString) {
                            inString = line[j];
                            j++;
                            continue;
                        }
                    }

                    if (!inString) {
                        if (line[j] === '/' && (line[j + 1] === '/' || line[j + 1] === '*')) {
                            if (line[j + 1] === '*') {
                                k = line.indexOf('*/');

                                if (k > j + 1) {
                                    line = line.substring(0, j) + new Array(k + 3 - j).join(' ') + line.substring(k + 2);
                                    continue;
                                } else {
                                    inComment = true;
                                }
                            }

                            line = line.substring(0, j);
                            break;
                        }
                    }

                    j++;
                }

                code[i] = line;
            } else { // In comment.
                k = line.indexOf('*/');

                if (k >= 0) {
                    // Fill comment part with spaces.
                    code[i] = new Array(k + 3).join(' ') + line.substring(k + 2);
                    inComment = false;
                    i--;
                } else {
                    // Whole string is comment, clear it.
                    code[i] = '';
                }
            }

            i++;
        }

        for (i = 0; i < code.length; i++) {
            code[i] = code[i].replace(/\s+$/g, '');
        }
    }


    function strip(str) {
        return str.replace(/^[\x20\t\r\n\f]+|[\x20\t\r\n\f]+$/g, '');
    }


    function parseJS(code, stripFunc) {
        /* jshint -W106 */
        var ast = jsParser.parse(code);

        ast = jsUglify.ast_lift_variables(ast);

        // Strip f() call.
        stripFunc(ast);

        return ast;
        /* jshint +W106 */
    }


    function parseJSExpression(code) {
        return parseJS(
            'f(\n' + code + '\n)',
            function(ast) { ast[1] = ast[1][0][1][2]; /* Strip f() call. */ }
        );
    }


    function parseJSFunction(code) {
        return parseJS(
            'function f() {\n' + code + '\n}',
            function(ast) { ast[1] = ast[1][0][3]; /* Strip function f() {} wrapper. */ }
        );
    }


    //function adjustJS(ast) {
        /* jshint -W106 */
    //    return jsUglify.gen_code(ast, {beautify: true, indent_start: 0});
        /* jshint +W106 */
    //}


    function skipWhitespaces(line, charAt) {
        while (charAt < line.length && whitespace.test(line[charAt])) {
            charAt++;
        }
        return charAt;
    }


    function getIndent(line) {
        return skipWhitespaces(line, 0);
    }


    function ConkittyParser(code) {
        this.src = code.split(/\n\r|\r\n|\r|\n/);
        this.code = code.split(/\n\r|\r\n|\r|\n/);
        clearComments(this.code);
        this.lineAt = this.charAt = 0;
    }


    function ConkittyCommandPart(type, code, lineAt, charAt) {
        this.type = type;
        this.src = code;
        this.lineAt = lineAt === undefined ? code.lineAt : lineAt;
        this.charAt = charAt === undefined ? code.charAt : charAt;
    }


    function getErrorMessage(msg, code, lineAt, charAt) {
        lineAt = lineAt === undefined ? code.lineAt : lineAt;
        charAt = charAt === undefined ? code.charAt : charAt;
        return msg +
               ' (line: ' + (lineAt + 1) +
               ', col: ' + (charAt + 1) + '):\n' +
               code.src[lineAt] + '\n' + (new Array(charAt + 1).join(' ')) + '^';
    }


    Conkitty.BadIndentation = function(code) {
        this.name = 'BadIndentation';
        this.message = getErrorMessage('Bad indentation', code);
        this.stack = (new Error()).stack;
    };
    Conkitty.UnexpectedSymbol = function(code) {
        this.name = 'UnexpectedSymbol';
        this.message = getErrorMessage('Unexpected symbol', code);
        this.stack = (new Error()).stack;
    };
    Conkitty.IllegalName = function(part) {
        this.name = 'IllegalName';
        this.message = getErrorMessage('Illegal ' + part.type, part.src, part.lineAt, part.charAt);
        this.stack = (new Error()).stack;
    };
    Conkitty.UnterminatedPart = function(part) {
        this.name = 'UnterminatedPart';
        this.message = getErrorMessage('Unterminated ' + part.type, part.src, part.lineAt, part.charAt);
        this.stack = (new Error()).stack;
    };
    Conkitty.JSParseError = function(msg, code, lineAt, charAt) {
        this.name = 'JSParseError';
        this.message = getErrorMessage(msg, code, lineAt, charAt);
        this.stack = (new Error()).stack;
    };
    Conkitty.DuplicateDecl = function(part) {
        this.name = 'DuplicateDecl';
        this.message = getErrorMessage('Duplicate ' + part.type, part.src, part.lineAt, part.charAt);
        this.stack = (new Error()).stack;
    };
    Conkitty.InconsistentCommand = function(part) {
        this.name = 'InconsistentCommand';
        this.message = getErrorMessage(
            part instanceof ConkittyPatternPart ?
                'Incomplete command' : 'Unexpected ' + part.type,
            part.src,
            part.lineAt,
            part.charAt
        );
        this.stack = (new Error()).stack;
    };
    Conkitty.BadIndentation.prototype = new Error();
    Conkitty.UnexpectedSymbol.prototype = new Error();
    Conkitty.IllegalName.prototype = new Error();
    Conkitty.UnterminatedPart.prototype = new Error();
    Conkitty.JSParseError.prototype = new Error();
    Conkitty.DuplicateDecl.prototype = new Error();
    Conkitty.InconsistentCommand.prototype = new Error();


    ConkittyParser.prototype.skipEmptyLines = function skipEmptyLines() {
        while (this.lineAt < this.code.length &&
               skipWhitespaces(this.code[this.lineAt], 0) === this.code[this.lineAt].length)
        {
            this.lineAt++;
        }

        this.charAt = 0;

        return this.lineAt < this.code.length;
    };


    ConkittyParser.prototype.readBlock = function readBlock(indent) {
        if (!this.skipEmptyLines()) { return false; }

        this.charAt = getIndent(this.code[this.lineAt]);

        var block = [];

        while (this.charAt === indent) {
            block.push(this.readCommand(indent));

            if (!this.skipEmptyLines()) { break; }

            this.charAt = getIndent(this.code[this.lineAt]);
        }

        if (this.charAt > indent) {
            throw new Conkitty.BadIndentation(this);
        }

        return block;
    };


    ConkittyParser.prototype.readCommand = function readCommand(indent) {
        var ret = {lineAt: this.lineAt, charAt: this.charAt, src: this},
            val = [],
            i,
            templateName = indent === 0 ? 1 : 0,
            classAttrValue = 0,
            attrValue = 0;

        while (this.charAt < this.code[this.lineAt].length) {
            if (templateName) {
                templateName++;
                if (templateName > 2) { templateName = 0; }
            }

            if (classAttrValue) {
                classAttrValue++;
                if (classAttrValue > 2) { classAttrValue = 0; }
            }

            if (attrValue) {
                attrValue++;
                if (attrValue > 2) { attrValue = 0; }
            }

            switch (this.code[this.lineAt][this.charAt]) {
                case '$':
                    if (classAttrValue || attrValue) {
                        val[val.length - 1].mode = 'replace';
                        val[val.length - 1].value = this.readVariable();
                    } else {
                        val.push(this.readVariable());
                    }
                    break;

                case '"':
                case "'":
                    if (classAttrValue || attrValue) {
                        val[val.length - 1].mode = 'replace';
                        val[val.length - 1].value = this.readString(true);
                    } else {
                        val.push(this.readString());
                    }
                    break;

                case '(':
                    if (classAttrValue || attrValue) {
                        val[val.length - 1].mode = 'replace';
                        val[val.length - 1].value = this.readJS(undefined, true);
                    } else {
                        val.push(this.readJS());
                    }
                    break;

                case '@':
                    if (classAttrValue || attrValue) {
                        throw new Conkitty.UnexpectedSymbol(this);
                    }

                    val.push(this.readAttrName());
                    if (val[val.length - 1].name === 'class') {
                        classAttrValue = 1;
                    } else {
                        attrValue = 1;
                    }
                    break;

                case '+':
                    if (classAttrValue || attrValue) {
                        val[val.length - 1].mode = 'add';

                        this.charAt++;

                        switch (this.code[this.lineAt][this.charAt]) {
                            case '$':
                                val[val.length - 1].value = this.readVariable();
                                break;

                            case '"':
                            case "'":
                                val[val.length - 1].value = this.readString(true);
                                break;

                            case '(':
                                val[val.length - 1].value = this.readJS(undefined, true);
                                break;

                            default:
                                if (classAttrValue) {
                                    val[val.length - 1].value = this.readCSS(true);
                                }
                        }
                    }

                    break;

                case '-':
                    if (classAttrValue) {
                        val[val.length - 1].mode = 'remove';

                        this.charAt++;

                        switch (this.code[this.lineAt][this.charAt]) {
                            case '$':
                                val[val.length - 1].value = this.readVariable();
                                break;

                            case '"':
                            case "'":
                                val[val.length - 1].value = this.readString(true);
                                break;

                            case '(':
                                val[val.length - 1].value = this.readJS(undefined, true);
                                break;

                            default:
                                val[val.length - 1].value = this.readCSS(true);
                        }
                    }

                    break;

                case '&':
                    val.push(this.readInclude());
                    break;

                default:
                    if (!attrValue) {
                        if (templateName) {
                            val.push(this.readTemplateName());
                        } else if (/[A-Z]/.test(this.code[this.lineAt][this.charAt])) {
                            val.push(this.readCommandName());
                            // Next part is a template name.
                            if (val[val.length - 1].value === 'CALL') {
                                templateName = 1;
                            }
                        } else {
                            if (classAttrValue) {
                                val[val.length - 1].mode = 'replace';
                                val[val.length - 1].value = this.readCSS(true);
                            } else {
                                val.push(this.readCSS());
                            }
                        }
                    }
            }

            if (this.charAt < this.code[this.lineAt].length) {
                i = skipWhitespaces(this.code[this.lineAt], this.charAt);

                if (this.charAt === i) {
                    throw new Conkitty.UnexpectedSymbol(this);
                }

                this.charAt = i;
            }
        }

        ret.value = val;

        this.lineAt++;

        if (this.skipEmptyLines()) {
            this.charAt = getIndent(this.code[this.lineAt]);

            if (this.charAt > indent) {
                ret.children = this.readBlock(this.charAt);
            }
        }

        return ret;
    };


    ConkittyParser.prototype._readName = function _readName(type, stopExpr, checkExpr) {
        var val = [],
            line = this.code[this.lineAt],
            ret = new ConkittyCommandPart(type, this);

        while (this.charAt < line.length && !stopExpr.test(line[this.charAt])) {
            val.push(line[this.charAt++]);
        }

        val = val.join('');

        if (!val.match(checkExpr)) {
            throw new Conkitty.IllegalName(ret);
        }

        ret.value = val;

        return ret;
    };


    ConkittyParser.prototype.readTemplateName = function readTemplateName() {
        return this._readName(CONKITTY_TYPE_TEMPLATE_NAME, whitespace, /^[a-zA-Z_][a-zA-Z0-9_-]*:?[a-zA-Z0-9_-]*$/);
    };


    ConkittyParser.prototype.readCommandName = function readCommandName() {
        return this._readName(CONKITTY_TYPE_COMMAND_NAME, /[^A-Z]/, /^(?:ATTR|CALL|CHOOSE|EACH|ELSE|EXCEPT|MEM|OTHERWISE|PAYLOAD|SET|TEST|TRIGGER|WHEN|WITH)$/);
    };


    ConkittyParser.prototype.readAttrName = function readAttrName() {
        this.charAt++;
        var ret = this._readName(CONKITTY_TYPE_ATTR, cssStopExpr, cssNameCheckExpr);
        ret.name = ret.value;
        delete ret.value;
        return ret;
    };


    ConkittyParser.prototype.readInclude = function readInclude() {
        this.charAt++;

        var ret = this._readName(CONKITTY_TYPE_INCLUDE, cssStopExpr, /^(?:js|css|img)$/);

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.code[this.lineAt][this.charAt] !== '"' &&
            this.code[this.lineAt][this.charAt] !== "'")
        {
            throw new Conkitty.UnexpectedSymbol(this);
        }

        ret.fileType = ret.value;
        ret.value = this.readString(true);

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.charAt !== this.code[this.lineAt].length) {
            throw new Conkitty.UnexpectedSymbol(this);
        }

        return ret;
    };


    ConkittyParser.prototype.readCSS = function readCSS(classesOnly) {
        var line = this.code[this.lineAt],
            ret = new ConkittyCommandPart(CONKITTY_TYPE_CSS, this),
            tmp,
            tmp2,
            lastBEMBlock,
            val = ret.value = {
                tag: null,
                id: null,
                attrs: {},
                classes: {},
                ifs: []
            };

        while (this.charAt < line.length && !whitespace.test(line[this.charAt]) && line[this.charAt] !== ',' && line[this.charAt] !== ')') {
            switch (line[this.charAt]) {
                case '.':
                    tmp = this.readCSSClass();
                    // In case class looks like BEM class with modifier, cut
                    // off modifier value (to check for duplicates):
                    //     `b-block_mod_val` -> `b-block_mod`
                    //     `b-block__elem_mod_val` -> `b-block__elem_mod`.
                    tmp2 = tmp.value.replace(/^([a-zA-Z][a-zA-Z0-9-]*(?:__[a-zA-Z][a-zA-Z0-9-]*)?_[a-zA-Z][a-zA-Z0-9-]*)(?:_[a-zA-Z][a-zA-Z0-9-]*)?$/, '$1');
                    if (tmp2 in val.classes) { throw new Conkitty.DuplicateDecl(tmp); }
                    val.classes[tmp2] = tmp;
                    break;

                case '[':
                    if (classesOnly) { throw new Conkitty.UnexpectedSymbol(this); }
                    tmp = this.readCSSAttr();
                    if (tmp.name in val.attrs) { throw new Conkitty.DuplicateDecl(tmp); }
                    val.attrs[tmp.name] = tmp;
                    break;

                case '#':
                    if (classesOnly) { throw new Conkitty.UnexpectedSymbol(this); }
                    tmp = this.readCSSId();
                    if (val.id !== null) { throw new Conkitty.DuplicateDecl(tmp); }
                    val.id = tmp;
                    break;

                case '%':
                    lastBEMBlock = this.readCSSBEMBlock();
                    if (lastBEMBlock.value in val.classes) { throw new Conkitty.DuplicateDecl(lastBEMBlock); }
                    val.classes[lastBEMBlock.value] = lastBEMBlock;
                    break;

                case '{':
                    tmp = this.readCSSBEMMod(lastBEMBlock);
                    if (tmp.name in val.classes) { throw new Conkitty.DuplicateDecl(tmp); }
                    val.classes[tmp.name] = tmp;
                    break;

                case ':':
                    val.ifs.push(this.readCSSIf(classesOnly));
                    break;

                default:
                    if (!classesOnly && /[a-z]/.test(line[this.charAt])) {
                        tmp = this.readCSSTag();
                        if (val.tag !== null) { throw new Conkitty.DuplicateDecl(tmp); }
                        val.tag = tmp;
                    } else {
                        throw new Conkitty.UnexpectedSymbol(this);
                    }
            }
        }

        return ret;
    };


    ConkittyParser.prototype.readCSSTag = function readCSSTag() {
        return this._readName(CONKITTY_TYPE_CSS_TAG, cssStopExpr, tagCheckExpr);
    };


    ConkittyParser.prototype.readCSSClass = function readCSSClass() {
        this.charAt++;
        return this._readName(CONKITTY_TYPE_CSS_CLASS, cssStopExpr, cssNameCheckExpr);
    };


    ConkittyParser.prototype.readCSSAttr = function readCSSAttr() {
        var ret = new ConkittyCommandPart(CONKITTY_TYPE_CSS_ATTR, this),
            name,
            val;

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        if (this.charAt === this.code[this.lineAt].length) {
            throw new Conkitty.UnterminatedPart(ret);
        }

        name = this._readName(CONKITTY_TYPE_CSS_ATTR_NAME, cssStopExpr, cssNameCheckExpr);

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.code[this.lineAt][this.charAt] === '=') {
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

            if (this.charAt === this.code[this.lineAt].length) {
                throw new Conkitty.UnterminatedPart(ret);
            }

            switch (this.code[this.lineAt][this.charAt]) {
                case '$':
                    val = this.readVariable();
                    break;

                case '(':
                    val = this.readJS(undefined, true);
                    break;

                case '"':
                case "'":
                    val = this.readString(true);
                    break;

                case ']':
                    throw new Conkitty.UnterminatedPart(ret);

                default:
                    throw new Conkitty.UnexpectedSymbol(this);
            }

            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
        }

        if (this.code[this.lineAt][this.charAt] !== ']') {
            throw new Conkitty.UnterminatedPart(ret);
        }

        this.charAt++;

        ret.name = name.value;
        ret.value = val;

        return ret;
    };


    ConkittyParser.prototype.readCSSId = function readCSSId() {
        this.charAt++;
        return this._readName(CONKITTY_TYPE_CSS_ID, cssStopExpr, cssNameCheckExpr);
    };


    ConkittyParser.prototype.readCSSBEMBlock = function readCSSBEMBlock() {
        var block,
            elem;

        this.charAt++;

        block = this._readName(CONKITTY_TYPE_CSS_BEM, bemStopExpr, bemCheckExpr);

        if (this.code[this.lineAt][this.charAt] === '(') {
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);
            elem = this._readName(CONKITTY_TYPE_CSS_BEM, bemStopExpr, bemCheckExpr);
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

            if (this.code[this.lineAt][this.charAt] !== ')') {
                throw new Conkitty.UnexpectedSymbol(this);
            }

            this.charAt++;

            block.value += '__' + elem.value;
        }

        return block;
    };


    ConkittyParser.prototype.readCSSBEMMod = function readCSSBEMMod(block) {
        if (!block) { throw new Conkitty.UnexpectedSymbol(this); }

        var ret = new ConkittyCommandPart(CONKITTY_TYPE_CSS_BEM_MOD, this),
            name,
            val;

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        if (this.charAt === this.code[this.lineAt].length) {
            throw new Conkitty.UnterminatedPart(ret);
        }

        name = this._readName(CONKITTY_TYPE_CSS_BEM, bemStopExpr, bemCheckExpr);

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.code[this.lineAt][this.charAt] === '=') {
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

            if (this.charAt === this.code[this.lineAt].length) {
                throw new Conkitty.UnterminatedPart(ret);
            }

            switch (this.code[this.lineAt][this.charAt]) {
                case '$':
                    val = this.readVariable();
                    break;

                case '(':
                    val = this.readJS(undefined, true);
                    break;

                case '"':
                case "'":
                    val = this.readString(true);
                    break;

                case '}':
                    throw new Conkitty.UnterminatedPart(ret);

                default:
                    throw new Conkitty.UnexpectedSymbol(this);
            }

            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
        }

        if (this.code[this.lineAt][this.charAt] !== '}') {
            throw new Conkitty.UnterminatedPart(ret);
        }

        this.charAt++;

        ret.name = block.value + '_' + name.value;
        ret.value = val;

        return ret;
    };


    ConkittyParser.prototype.readCSSIf = function readCSSIf(classesOnly) {
        var ret = new ConkittyCommandPart(CONKITTY_TYPE_CSS_IF, this);

        this.charAt++;

        this._readName(CONKITTY_TYPE_CSS_CLASS, cssStopExpr, /^if$/);

        if (this.code[this.lineAt][this.charAt] !== '(') { throw new Conkitty.UnexpectedSymbol(this); }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        switch (this.code[this.lineAt][this.charAt]) {
            case '$':
                ret.cond = this.readVariable();
                break;

            case '(':
                ret.cond = this.readJS(undefined, true);
                break;

            default:
                throw new Conkitty.UnexpectedSymbol(this);
        }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
        if (this.code[this.lineAt][this.charAt] !== ',') { throw new Conkitty.UnexpectedSymbol(this); }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);
        if (this.code[this.lineAt][this.charAt] !== ',') {
            ret.positive = this.readCSS(classesOnly);
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
        }

        if (this.code[this.lineAt][this.charAt] === ',') {
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);
            ret.negative = this.readCSS(classesOnly);
            this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
        }

        if (this.code[this.lineAt][this.charAt] === ')') {
            this.charAt++;
        } else {
            throw new Conkitty.UnexpectedSymbol(this);
        }

        return ret;
    };


    ConkittyParser.prototype.readVariable = function readVariable() {
        this.charAt++;
        return this._readName(CONKITTY_TYPE_VARIABLE, variableStopExpr, variableCheckExpr);
    };


    ConkittyParser.prototype.readString = function readString(noRaw) {
        var line = this.code[this.lineAt],
            closer = line[this.charAt],
            raw = false, // Indicates that string is enclosed in triple quotes.
            i = this.charAt + 1,
            val = [],
            ret = new ConkittyCommandPart(CONKITTY_TYPE_STRING, this);

        if (!noRaw && line[i] === closer && line[i + 1] === closer) {
            raw = true;
            i += 2;
        }

        while (i < line.length) {
            if (line[i] === '\\' && (line[i + 1] === '\\' || line[i + 1] === closer)) {
                val.push('\\');
                val.push(line[i + 1]);
                i += 2;
            } else {
                if (line[i] === closer) { break; }
                val.push(line[i++]);
            }
        }

        if (line[i] !== closer ||
            (raw && (line[i + 1] !== closer || line[i + 2] !== closer)))
        {
            throw new Conkitty.UnterminatedPart(ret);
        }

        this.charAt = i + (raw ? 3 : 1);

        ret.value = closer + val.join('') + closer;
        ret.raw = raw;

        return ret;
    };


    ConkittyParser.prototype.readJS = function readJS(indent, noRaw) {
        var ret = new ConkittyCommandPart(CONKITTY_TYPE_JAVASCRIPT, this),
            val = [];

        if (!indent) {
            var brackets,
                inString = false,
                raw = 0;

            brackets = 1;
            this.charAt++;

            if (!noRaw &&
                this.code[this.lineAt][this.charAt] === '(' &&
                this.code[this.lineAt][this.charAt + 1] === '(')
            {
                raw = 2;
                this.charAt += 2;
            }

            if (this.charAt === this.code[this.lineAt].length) {
                this.lineAt++;

                val.push('\n');

                if (!this.skipEmptyLines()) {
                    throw new Conkitty.UnterminatedPart(ret);
                }
            }

            while (this.charAt < this.code[this.lineAt].length) {
                if (!inString) {
                    if (this.code[this.lineAt][this.charAt] === '(') {
                        brackets++;
                    } else if (this.code[this.lineAt][this.charAt] === ')') {
                        brackets--;
                        // Avoiding this: (((   function(){})(   ))).
                        if (brackets === 0) {
                            if (raw &&
                                (this.code[this.lineAt][this.charAt + 1] !== ')' ||
                                 this.code[this.lineAt][this.charAt + 2] !== ')'))
                            {
                                brackets += raw;
                                raw = 0;
                                val.unshift('((');
                            } else {
                                this.charAt += (raw + 1);
                                break;
                            }
                        }
                    /* jshint -W109 */
                    } else if (this.code[this.lineAt][this.charAt] === '"' ||
                        this.code[this.lineAt][this.charAt] === "'")
                    /* jshint +W109 */
                    {
                        inString = this.code[this.lineAt][this.charAt];
                    }
                } else {
                    if (this.code[this.lineAt][this.charAt] === '\\' &&
                        (this.code[this.lineAt][this.charAt + 1] === '\\' ||
                         this.code[this.lineAt][this.charAt + 1] === inString))
                    {
                        val.push('\\');
                        this.charAt++;
                    } else if (this.code[this.lineAt][this.charAt] === inString) {
                        inString = false;
                    }
                }

                val.push(this.code[this.lineAt][this.charAt]);

                this.charAt++;


                if (this.charAt === this.code[this.lineAt].length) {
                    this.lineAt++;

                    val.push('\n');

                    if (!this.skipEmptyLines()) {
                        throw new Conkitty.UnterminatedPart(ret);
                    }
                }
            }

            val = val.join('');

            if (!strip(val)) {
                throw new Conkitty.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
            }

            ret.raw = !!raw;
            ret.expr = true;
            ret.value = val;
        } else {
            while (this.skipEmptyLines() && getIndent(this.code[this.lineAt]) > indent) {
                val.push(this.code[this.lineAt].substring(indent));
                this.lineAt++;
            }

            this.lineAt--;
            this.charAt = this.code[this.lineAt].length;

            val = val.join('\n');

            ret.raw = false;
            ret.expr = false;
            ret.value = val;

            if (!strip(val)) {
                throw new Conkitty.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
            }
        }


        try {
            (indent ? parseJSFunction : parseJSExpression)(val);
        } catch(e) {
            throw new Conkitty.JSParseError(
                e.message,
                this,
                ret.lineAt + e.line - 1 - (indent ? 0 : 1),
                (indent || e.line > 2 ? -1 : ret.charAt + (ret.raw ? 2 : 0)) + e.col
            );
        }

        return ret;
    };


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
                new ConkittyPatternPart(tree.value, 1, CONKITTY_TYPE_TEMPLATE_NAME, null),
                new ConkittyPatternPart(tree.value, '*', CONKITTY_TYPE_VARIABLE, null)
            ];

        error = conkittyMatch(tree.value, pattern);
        if (error) { throw new Conkitty.InconsistentCommand(error); }

        var name = tree.value[0].value;

        if (name in this.tpls) {
            throw new Conkitty.DuplicateDecl(tree.value[0]);
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
            new ConkittyPatternPart(1, CONKITTY_TYPE_COMMAND_NAME, 'CALL'),

            new ConkittyPatternPart(1, CONKITTY_TYPE_TEMPLATE_NAME, null,
                                       CONKITTY_TYPE_JAVASCRIPT, null,
                                       CONKITTY_TYPE_VARIABLE, null),

            new ConkittyPatternPart('*', CONKITTY_TYPE_VARIABLE, null,
                                         CONKITTY_TYPE_JAVASCRIPT, null,
                                         CONKITTY_TYPE_STRING, null,
                                         CONKITTY_TYPE_COMMAND_NAME, 'PAYLOAD')
        ];*/
    };


    Conkitty.prototype.push = function push(code) {
        code = new ConkittyParser(code);
        this.code = this.code.concat(code.readBlock(0));
    };


    Conkitty.prototype.compile = function compile() {
        var gen = new ConkittyGenerator(this.code);
        gen.process();
        return gen.generate();
    };


    return Conkitty;
})();
