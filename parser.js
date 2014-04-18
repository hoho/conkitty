/*!
 * conkitty, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';

var ConkittyErrors = require(__dirname + '/errors.js'),
    ConkittyTypes = require(__dirname + '/types.js'),
    utils = require(__dirname + '/utils.js'),
    parseJSFunction = utils.parseJSFunction,
    parseJSExpression = utils.parseJSExpression,

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
        throw new ConkittyErrors.BadIndentation(this);
    }

    return block;
};


ConkittyParser.prototype.readCommand = function readCommand(indent) {
    var ret = {lineAt: this.lineAt, charAt: this.charAt, src: this, children: []},
        val = [],
        i,
        templateName = indent === 0 ? 1 : 0,
        classAttrValue = 0,
        attrValue = 0,
        argumentsDecl,
        argumentsVal;

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
                    throw new ConkittyErrors.UnexpectedSymbol(this);
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
                if (argumentsDecl) {
                    val.push(this.readArgument(true));
                } else if (argumentsVal) {
                    val.push(this.readArgument(false));
                } else if (!attrValue) {
                    if (templateName) {
                        val.push(this.readTemplateName());
                        if (indent === 0) {
                            argumentsDecl = true;
                        } else {
                            argumentsVal = true;
                        }
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
                            val.push(this.readCSSOrTemplateName());
                            if (val[val.length - 1].type === ConkittyTypes.TEMPLATE_NAME) {
                                argumentsVal = true;
                            }
                        }
                    }
                }
        }

        if (this.charAt < this.code[this.lineAt].length) {
            i = skipWhitespaces(this.code[this.lineAt], this.charAt);

            if (this.charAt === i) {
                throw new ConkittyErrors.UnexpectedSymbol(this);
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


ConkittyParser.prototype._readName = function _readName(type, stopExpr, checkExpr, offset) {
    var val = [],
        line = this.code[this.lineAt],
        ret = new ConkittyCommandPart(type, this);

    this.charAt += (offset || 0);

    while (this.charAt < line.length && !stopExpr.test(line[this.charAt])) {
        val.push(line[this.charAt++]);
    }

    val = val.join('');

    if (!val.match(checkExpr)) {
        throw new ConkittyErrors.IllegalName(ret);
    }

    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readTemplateName = function readTemplateName() {
    var ret = this._readName(ConkittyTypes.TEMPLATE_NAME, whitespace, /^(?:(?:[a-zA-Z0-9_-]*(?:\:\:)?[a-zA-Z0-9_-]+)|(?:[a-zA-Z0-9_-]+\:\:))$/),
        i;

    if (ret.value.substring(0, 2) === '::') { ret.value = ret.value.substring(2); }

    i = ret.value.indexOf('::');

    if (i >= 0) {
        // We have non-empty namespace.
        ret.namespace = ret.value.substring(0, i);
        ret.value = ret.value.substring(i + 2);
    } else {
        ret.namespace = '';
    }

    return ret;
};


ConkittyParser.prototype.readArgument = function readArgument(isDecl) {
    var ret = this._readName(
        isDecl ? ConkittyTypes.ARGUMENT_DECL : ConkittyTypes.ARGUMENT_VAL,
        variableStopExpr,
        variableCheckExpr
    );

    ret.name = ret.value;
    delete ret.value;

    if (this.code[this.lineAt][this.charAt] === '[') {
        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        switch (this.code[this.lineAt][this.charAt]) {
            case '(':
                ret.value = this.readJS(undefined, true);
                break;

            case '"':
            case "'":
                ret.value = this.readString(true);
                break;

            case '$':
                /* jshint -W086 */
                if (!isDecl) {
                    ret.value = this.readVariable();
                    break;
                }

            default:
                throw new ConkittyErrors.UnexpectedSymbol(this);
                /* jshint +W086 */
        }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.code[this.lineAt][this.charAt] !== ']') {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.charAt++;

    } else if (!isDecl) {
        if (ret.name === 'PAYLOAD') {
            ret = new ConkittyCommandPart(ConkittyTypes.COMMAND_NAME, this, ret.lineAt, ret.charAt);
            ret.value = 'PAYLOAD';
        } else {
            throw new ConkittyErrors.IncompletePart(ret);
        }
    }

    return ret;
};


ConkittyParser.prototype.readCommandName = function readCommandName() {
    return this._readName(ConkittyTypes.COMMAND_NAME, /[^A-Z]/, /^(?:ATTR|CALL|CHOOSE|EACH|ELSE|EXCEPT|MEM|OTHERWISE|PAYLOAD|SET|TEST|TRIGGER|WHEN|WITH)$/);
};


ConkittyParser.prototype.readAttrName = function readAttrName() {
    var ret = this._readName(ConkittyTypes.ATTR, cssStopExpr, cssNameCheckExpr, 1);
    ret.name = ret.value;
    delete ret.value;
    return ret;
};


ConkittyParser.prototype.readInclude = function readInclude() {
    var charAt = this.charAt;
    this.charAt = skipWhitespaces(this.code[this.lineAt], charAt + 1);

    if (this.code[this.lineAt][this.charAt] !== '"' &&
        this.code[this.lineAt][this.charAt] !== "'")
    {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    var ret = this.readString(true);
    ret.type = ConkittyTypes.INCLUDE;
    ret.charAt = charAt;

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

    if (this.charAt !== this.code[this.lineAt].length) {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    return ret;
};


ConkittyParser.prototype.readCSSOrTemplateName = function readCSSOrTemplateName() {
    var i = this.charAt,
        line = this.code[this.lineAt];

    while (i < line.length && !cssStopExpr.test(line[i])) {
        i++;
    }

    if (line[i] === ':' && line[i + 1] === ':') {
        return this.readTemplateName();
    } else {
        return this.readCSS();
    }
};


ConkittyParser.prototype.readCSS = function readCSS(classesOnly) {
    var line = this.code[this.lineAt],
        ret = new ConkittyCommandPart(ConkittyTypes.CSS, this),
        tmp,
        tmp2,
        lastBEMBlock,
        val = ret.value = {
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
                if (tmp2 in val.classes) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                val.classes[tmp2] = tmp;
                break;

            case '[':
                if (classesOnly) { throw new ConkittyErrors.UnexpectedSymbol(this); }
                tmp = this.readCSSAttr();
                if (tmp.name in val.attrs) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                val.attrs[tmp.name] = tmp;
                break;

            case '#':
                if (classesOnly) { throw new ConkittyErrors.UnexpectedSymbol(this); }
                tmp = this.readCSSId();
                if ('id' in val.attrs) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                val.attrs.id = tmp;
                break;

            case '%':
                lastBEMBlock = this.readCSSBEMBlock();
                if (lastBEMBlock.value in val.classes) { throw new ConkittyErrors.DuplicateDecl(lastBEMBlock); }
                val.classes[lastBEMBlock.value] = lastBEMBlock;
                break;

            case '{':
                tmp = this.readCSSBEMMod(lastBEMBlock);
                if (tmp.name in val.classes) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                val.classes[tmp.name] = tmp;
                break;

            case ':':
                val.ifs.push(this.readCSSIf(classesOnly));
                break;

            default:
                if (!classesOnly && /[a-z]/.test(line[this.charAt])) {
                    tmp = this.readCSSTag();
                    if ('' in val.attrs) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                    val.attrs[''] = tmp;
                } else {
                    throw new ConkittyErrors.UnexpectedSymbol(this);
                }
        }
    }

    return ret;
};


ConkittyParser.prototype.readCSSTag = function readCSSTag() {
    return this._readName(ConkittyTypes.CSS_TAG, cssStopExpr, tagCheckExpr);
};


ConkittyParser.prototype.readCSSClass = function readCSSClass() {
    return this._readName(ConkittyTypes.CSS_CLASS, cssStopExpr, cssNameCheckExpr, 1);
};


ConkittyParser.prototype.readCSSAttr = function readCSSAttr() {
    var ret = new ConkittyCommandPart(ConkittyTypes.CSS_ATTR, this),
        name,
        val;

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

    if (this.charAt === this.code[this.lineAt].length) {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    name = this._readName(ConkittyTypes.CSS_ATTR_NAME, cssStopExpr, cssNameCheckExpr);

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

    if (this.code[this.lineAt][this.charAt] === '=') {
        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        if (this.charAt === this.code[this.lineAt].length) {
            throw new ConkittyErrors.UnterminatedPart(ret);
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
                throw new ConkittyErrors.UnterminatedPart(ret);

            default:
                throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
    }

    if (this.code[this.lineAt][this.charAt] !== ']') {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    this.charAt++;

    ret.name = name.value;
    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readCSSId = function readCSSId() {
    return this._readName(ConkittyTypes.CSS_ID, cssStopExpr, cssNameCheckExpr, 1);
};


ConkittyParser.prototype.readCSSBEMBlock = function readCSSBEMBlock() {
    var block,
        elem;

    block = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr, 1);

    if (this.code[this.lineAt][this.charAt] === '(') {
        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);
        elem = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr);
        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

        if (this.code[this.lineAt][this.charAt] !== ')') {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.charAt++;

        block.value += '__' + elem.value;
    }

    return block;
};


ConkittyParser.prototype.readCSSBEMMod = function readCSSBEMMod(block) {
    if (!block) { throw new ConkittyErrors.UnexpectedSymbol(this); }

    var ret = new ConkittyCommandPart(ConkittyTypes.CSS_BEM_MOD, this),
        name,
        val;

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

    if (this.charAt === this.code[this.lineAt].length) {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    name = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr);

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);

    if (this.code[this.lineAt][this.charAt] === '=') {
        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

        if (this.charAt === this.code[this.lineAt].length) {
            throw new ConkittyErrors.UnterminatedPart(ret);
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
                throw new ConkittyErrors.UnterminatedPart(ret);

            default:
                throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
    }

    if (this.code[this.lineAt][this.charAt] !== '}') {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    this.charAt++;

    ret.name = block.value + '_' + name.value;
    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readCSSIf = function readCSSIf(classesOnly) {
    var ret = new ConkittyCommandPart(ConkittyTypes.CSS_IF, this);

    this._readName(ConkittyTypes.CSS_CLASS, cssStopExpr, /^if$/, 1);

    if (this.code[this.lineAt][this.charAt] !== '(') { throw new ConkittyErrors.UnexpectedSymbol(this); }

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt + 1);

    switch (this.code[this.lineAt][this.charAt]) {
        case '$':
            ret.cond = this.readVariable();
            break;

        case '(':
            ret.cond = this.readJS(undefined, true);
            break;

        default:
            throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.charAt = skipWhitespaces(this.code[this.lineAt], this.charAt);
    if (this.code[this.lineAt][this.charAt] !== ',') { throw new ConkittyErrors.UnexpectedSymbol(this); }

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
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    return ret;
};


ConkittyParser.prototype.readVariable = function readVariable() {
    return this._readName(ConkittyTypes.VARIABLE, variableStopExpr, variableCheckExpr, 1);
};


ConkittyParser.prototype.readString = function readString(noRaw) {
    var line = this.code[this.lineAt],
        closer = line[this.charAt],
        raw = false, // Indicates that string is enclosed in triple quotes.
        i = this.charAt + 1,
        val = [],
        ret = new ConkittyCommandPart(ConkittyTypes.STRING, this);

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
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    this.charAt = i + (raw ? 3 : 1);

    ret.value = closer + val.join('') + closer;
    ret.raw = raw;

    return ret;
};


ConkittyParser.prototype.readJS = function readJS(indent, noRaw) {
    var ret = new ConkittyCommandPart(ConkittyTypes.JAVASCRIPT, this),
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
                throw new ConkittyErrors.UnterminatedPart(ret);
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
                    throw new ConkittyErrors.UnterminatedPart(ret);
                }
            }
        }

        val = val.join('');

        if (!strip(val)) {
            throw new ConkittyErrors.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
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
            throw new ConkittyErrors.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
        }
    }


    try {
        (indent ? parseJSFunction : parseJSExpression)(val);
    } catch(e) {
        throw new ConkittyErrors.JSParseError(
            e.message,
            this,
                ret.lineAt + e.line - 1 - (indent ? 0 : 1),
                (indent || e.line > 2 ? -1 : ret.charAt + (ret.raw ? 2 : 0)) + e.col
        );
    }

    return ret;
};


module.exports.ConkittyParser = ConkittyParser;
