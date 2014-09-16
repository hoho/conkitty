/*!
 * conkitty, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';

var path = require('path'),

    ConkittyErrors = require(path.join(__dirname, 'errors.js')),
    ConkittyTypes = require(path.join(__dirname, 'types.js')),
    utils = require(path.join(__dirname, 'utils.js')),

    fs = require('fs'),

    whitespace = /[\x20\t\r\n\f]/,

    variableStopExpr = /[^a-zA-Z0-9_]/,
    variableCheckExpr = /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    cssStopExpr = /[^a-zA-Z0-9_-]/,
    cssNameCheckExpr = /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    tagCheckExpr = /^[a-z][a-zA-Z0-9_-]*$/,
    bemStopExpr = /[^a-zA-Z0-9-]/,
    bemCheckExpr = /^[a-zA-Z][a-zA-Z0-9-]*$/,

    commandExpr = /^(?:AS|ATTR|CALL|CHOOSE|EACH|ELSE|EXCEPT|EXPOSE|JS|MEM|OTHERWISE|PAYLOAD|SET|TEST|TRIGGER|WHEN|WITH)$/,

    argExpr = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;


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


function ConkittyParser(filename, code, base, precompileEnv) {
    this.filename = filename;
    if (code === undefined) { code = fs.readFileSync(filename, {encoding: 'utf8'}); }
    this.base = base || path.dirname(filename);
    this.src = code.split(/\n\r|\r\n|\r|\n/);
    this.code = code.split(/\n\r|\r\n|\r|\n/);
    clearComments(this.code);
    this.lineAt = this.charAt = 0;
    this.chars = [];
    this.charsPos = 0;
    this.currentChar = {line: 0, col: 0};
    this.inStringOrJS = false;
    this.precompileEnv = precompileEnv;
}


function ConkittyCommandPart(type, code, lineAt, charAt) {
    this.type = type;
    this.src = code;
    this.lineAt = lineAt === undefined ? code.currentChar.line : lineAt;
    this.charAt = charAt === undefined ? code.currentChar.col : charAt;
}


function execPrecompileExpr(expr, env) {
    var args = Object.keys(env || {}),
        i,
        arg,
        values = [],
        func;

    for (i = 0; i < args.length; i++) {
        arg = args[i];
        if (!argExpr.test(arg)) {
            throw new Error('Invalid key `' + arg + '`');
        }
        values.push(env[arg]);
    }

    func = new Function(
        args.join(','),
        'return ' + (expr.isFunc ? '(' + expr.value + ')()' : expr.value)
    );

    return func.apply(null, values) + '';
}


ConkittyParser.prototype.nextChar = function nextChar(noMove, lineContinues) {
    var ret,
        sameLine;

    if (this.charsPos < this.chars.length) {
        ret = this.chars[this.charsPos];
        if (ret.val === '\\' && !this.inStringOrJS) {
            // We've got `\` during reading JS expression, handle it.
            this.chars.splice(this.charsPos, 1);
            sameLine = true;
            while (((ret = this.chars[this.charsPos])) && (ret.EOL || whitespace.test(ret.val))) {
                if (ret.EOL) { sameLine = false; }
                this.chars.splice(this.charsPos, 1);
            }
            if (ret && sameLine) {
                this.currentChar = ret;
                throw new ConkittyErrors.UnexpectedSymbol(this);
            }
            return this.nextChar(noMove, sameLine ? 1 : 2);
        }
        if (!noMove) {
            this.currentChar = ret;
            this.charsPos++;
        }
    } else {
        if (this.lineAt < this.code.length) {
            if (this.charAt < this.code[this.lineAt].length) {
                ret = {
                    val: this.code[this.lineAt][this.charAt],
                    line: this.lineAt,
                    col: this.charAt,
                    id: this.chars.length
                };

                if (lineContinues || (ret.val === '\\' && !this.inStringOrJS)) {
                    if (lineContinues) {
                        sameLine = lineContinues === 1;
                    } else {
                        sameLine = true;
                        this.charAt++;
                    }
                    while (true) {
                        if (this.charAt < this.code[this.lineAt].length) {
                            if (whitespace.test(this.code[this.lineAt][this.charAt])) {
                                this.charAt++;
                            } else {
                                if (sameLine) {
                                    this.currentChar = {line: this.lineAt, col: this.charAt};
                                    throw new ConkittyErrors.UnexpectedSymbol(this);
                                } else {
                                    return this.nextChar(noMove);
                                }
                            }
                        } else {
                            this.lineAt++;
                            this.charAt = 0;
                            sameLine = false;
                            if (this.lineAt >= this.code.length) {
                                return this.nextChar(noMove);
                            }
                        }
                    }
                } else if (ret.val === '|' && !this.inStringOrJS) {
                    var i,
                        pos = this.chars.length,
                        expr = this.readPrecompileExpr(),
                        tmp,
                        tmp2;

                    try {
                        expr = execPrecompileExpr(expr, this.precompileEnv) || '';
                    } catch(e) {
                        throw new ConkittyErrors.PrecompileExprError('Failed to execute precompile expression: ' + e.message, this, ret.line, ret.col);
                    }

                    this.charsPos = pos;
                    tmp = this.chars.pop(); // readJS reads two more chars after
                                            // JS expression, first one is
                                            // closing `|` and we keep the last one here.
                    this.chars.splice(pos, this.chars.length);

                    for (i = 0; i < expr.length; i++) {
                        tmp2 = {
                            line: ret.line,
                            col: ret.col,
                            id: this.chars.length
                        };
                        if (expr[i] === '\n') {
                            tmp2.EOL = true;
                        } else {
                            tmp2.val = expr[i];
                        }
                        this.chars.push(tmp2);
                    }

                    this.chars.push(tmp);

                    return this.nextChar(noMove);
                }

                if (!noMove) {
                    this.charAt++;
                }
            } else {
                if (lineContinues) {
                    this.lineAt++;
                    this.charAt = 0;
                    return this.nextChar(noMove, 2);
                }

                ret = {
                    EOL: true,
                    line: this.lineAt,
                    col: this.charAt,
                    id: this.chars.length
                };

                if (!noMove) {
                    this.lineAt++;
                    this.charAt = 0;
                }
            }
        } else {
            ret = {
                EOF: true,
                EOL: true,
                line: this.lineAt,
                col: 0,
                id: this.chars.length
            };
        }

        if (!noMove) {
            this.currentChar = ret;
            this.chars.push(ret);
            this.charsPos++;
        }
    }

    return ret;
};


ConkittyParser.prototype.pushBack = function pushBack(count) {
    if (this.charsPos < count || count < 0) {
        throw new Error('Cannot push back `' + count + '` long');
    } else {
        if (count > 0) {
            this.charsPos -= count;
            this.currentChar = this.chars[this.charsPos];
        }
    }
};


ConkittyParser.prototype.skipWhitespaces = function skipWhitespaces() {
    var ret = 0;
    while (whitespace.test(this.nextChar(true).val)) {
        this.nextChar();
        ret++;
    }
    return ret;
};


ConkittyParser.prototype.getIndent = function getIndent() {
    return this.skipWhitespaces();
};


ConkittyParser.prototype.skipEmptyLines = function skipEmptyLines() {
    var ch,
        sincePrevEOL = 0;

    while (true) {
        ch = this.nextChar();
        if (ch.EOF) {
            return false;
        } else if (ch.EOL) {
            sincePrevEOL = 0;
        } else if (whitespace.test(ch.val)) {
            sincePrevEOL++;
        } else {
            this.pushBack(1);
            break;
        }
    }
    this.pushBack(sincePrevEOL);
    return true;
};


ConkittyParser.prototype.readBlock = function readBlock(indent) {
    if (!this.skipEmptyLines()) { return false; }

    var newIndent = indent,
        block = [];

    while (newIndent === indent) {
        block.push(this.readCommand(indent));
        if (!this.skipEmptyLines()) {
            break;
        }
        newIndent = this.getIndent();
    }

    if (newIndent > indent) {
        throw new ConkittyErrors.BadIndentation(this);
    } else {
        if (!this.nextChar(true).EOF) {
            this.pushBack(newIndent);
        }
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
        argumentsVal,
        ch;

    ch = this.nextChar(true);
    while (!ch.EOL) {
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

        switch (ch.val) {
            case '$':
                if (argumentsDecl) {
                    val.push(this.readArgument(true));
                } else if (classAttrValue || attrValue) {
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
                    this.nextChar();
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

            case '^':
                val.push(this.readAppender());
                break;

            default:
                if (argumentsDecl) {
                } else if (argumentsVal) {
                    val.push(this.readArgument(false));
                    if (val[val.length - 1].type === ConkittyTypes.COMMAND_NAME) {
                        argumentsVal = false;
                    }
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

        i = this.nextChar(true);
        this.skipWhitespaces();
        ch = this.nextChar(true);
        if (!ch.EOL && i.id === ch.id) {
            this.nextChar();
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }
    }

    ret.value = val;

    if (this.skipEmptyLines()) {
        var newIndent = this.getIndent();
        if (newIndent > indent) {
            ret.children = this.readBlock(newIndent);
        } else {
            this.pushBack(newIndent);
        }
    }

    return ret;
};


ConkittyParser.prototype._readName = function _readName(type, stopExpr, checkExpr, offset) {
    var val = [],
        ch,
        ret;

    ch = this.nextChar();

    offset = offset || 0;
    while (offset > 0) {
        ch = this.nextChar();
        offset--;
    }

    ret = new ConkittyCommandPart(type, this);

    while (ch.val && !stopExpr.test(ch.val)) {
        val.push(ch.val);
        ch = this.nextChar();
    }
    this.pushBack(1);

    val = val.join('');

    if (!val.match(checkExpr)) {
        throw new ConkittyErrors.IllegalName(ret);
    }

    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readTemplateName = function readTemplateName() {
    var ret = this._readName(
            ConkittyTypes.TEMPLATE_NAME,
            whitespace,
            /^(?:(?:[a-zA-Z0-9_-]*(?:\:\:)?[a-zA-Z0-9_-]+)|(?:[a-zA-Z0-9_-]+\:\:))$/
        ),
        i;

    if (ret.value.substring(0, 2) === '::') {
        ret.value = ret.value.substring(2);
    }

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
    var ch,
        ws,
        ret = this._readName(
            isDecl ? ConkittyTypes.ARGUMENT_DECL : ConkittyTypes.ARGUMENT_VAL,
            variableStopExpr,
            variableCheckExpr,
            isDecl ? 1 : 0
        );

    ret.name = ret.value;
    delete ret.value;

    ws = this.skipWhitespaces();
    ch = this.nextChar(true);

    if (ch.val === '=') {
        this.nextChar();

        if (commandExpr.test(ret.name)) {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.skipWhitespaces();
        ch = this.nextChar(true);

        switch (ch.val) {
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
                ch = this.nextChar();
                throw new ConkittyErrors.UnexpectedSymbol(this);
                /* jshint +W086 */
        }

        ch = this.nextChar(true);
        if (!whitespace.test(ch.val) && !ch.EOL) {
            this.nextChar();
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }
    } else {
        if (ws) {
            this.pushBack(ws);
        }
        ch = this.nextChar(true);
        if (!isDecl && (whitespace.test(ch.val) || ch.EOL)) {
            if (ret.name === 'PAYLOAD') {
                ret = new ConkittyCommandPart(ConkittyTypes.COMMAND_NAME, this, ret.lineAt, ret.charAt);
                ret.value = 'PAYLOAD';
            } else if (ret.name === 'AS') {
                ret = new ConkittyCommandPart(ConkittyTypes.COMMAND_NAME, this, ret.lineAt, ret.charAt);
                ret.value = 'AS';
            } else {
                throw new ConkittyErrors.IncompletePart(ret);
            }
        }
    }

    if (ret.type !== ConkittyTypes.COMMAND_NAME) {
        ret.name = '$' + ret.name;
        if (ret.name === '$C') {
            throw new ConkittyErrors.IllegalName(ret, '$C is reserved');
        }
    }

    return ret;
};


ConkittyParser.prototype.readCommandName = function readCommandName() {
    var ret = this._readName(ConkittyTypes.COMMAND_NAME, /[^A-Z]/, commandExpr);
    if (ret.value === 'JS') {
        var ch,
            args = [],
            count = 0,
            indent;

        this.pushBack(1);
        while (!this.nextChar(true).EOL) {
            this.pushBack(1);
            count++;
        }
        this.nextChar();
        indent = this.skipWhitespaces();

        count -= indent;
        while (count > 0) {
            this.nextChar();
            count--;
        }

        ch = this.nextChar(true);
        while (ch.val && args.length < 3) {
            this.skipWhitespaces();
            args.push(this.readVariable());
            ch = this.nextChar(true);
        }

        this.skipWhitespaces();
        ch = this.nextChar();

        if (!ch.EOL) {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        ret.args = args;
        ret.js = this.readJS(indent, true);
    }
    return ret;
};


ConkittyParser.prototype.readAttrName = function readAttrName() {
    var ret = this._readName(ConkittyTypes.ATTR, cssStopExpr, cssNameCheckExpr, 1);
    ret.name = ret.value;
    delete ret.value;
    return ret;
};


ConkittyParser.prototype.readInclude = function readInclude() {
    var start,
        ch;

    start = this.nextChar();
    if (start.val !== '&') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.skipWhitespaces();
    ch = this.nextChar(true);

    if (ch.val !== '"' && ch.val !== "'") {
        this.nextChar();
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    var ret = this.readString(true);
    ret.type = ConkittyTypes.INCLUDE;
    ret.charAt = start.col;

    ret.value = path.normalize(path.join(this.base || '.', utils.evalString(ret.value)));

    this.skipWhitespaces();
    ch = this.nextChar(true);

    if (!ch.EOL) {
        this.nextChar();
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    return ret;
};


ConkittyParser.prototype.readAppender = function readAppender() {
    var ret,
        ch;

    ch = this.nextChar();
    if (ch.val !== '^') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    ret = new ConkittyCommandPart(ConkittyTypes.NODE_APPENDER, this);

    ch = this.nextChar(true);
    switch (ch.val) {
        case '$':
            ret.value = this.readVariable();
            break;

        case '(':
            ret.value = this.readJS(undefined, true);
            break;

        default:
            this.nextChar();
            throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    return ret;
};


ConkittyParser.prototype.readCSSOrTemplateName = function readCSSOrTemplateName() {
    var count = 1,
        ch,
        ch2;

    ch = this.nextChar();
    while (!ch.EOL && !cssStopExpr.test(ch.val)) {
        ch = this.nextChar();
        count++;
    }

    ch2 = this.nextChar();
    this.pushBack(count + 1);


    if (ch.val === ':' && ch2.val === ':') {
        return this.readTemplateName();
    } else {
        return this.readCSS();
    }
};


ConkittyParser.prototype.readCSS = function readCSS(classesOnly, lastBEMBlock) {
    var ch,
        ret,
        tmp,
        tmp2,
        val;

    this.nextChar();
    ret = new ConkittyCommandPart(ConkittyTypes.CSS, this);
    val = ret.value = {
        attrs: {},
        classes: {},
        ifs: [],
        names: []
    };
    this.pushBack(1);
    ch = this.nextChar(true);

    while (!ch.EOL && !whitespace.test(ch.val) && ch.val !== ',' && ch.val !== ')') {
        switch (ch.val) {
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
                if (tmp.name in val.attrs) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                val.attrs[tmp.name] = tmp;
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
                tmp = this.readCSSConditional(classesOnly, lastBEMBlock);
                if (tmp.what === 'if') {
                    val.ifs.push(tmp);
                } else if (tmp.what === 'elem') {
                    val.names.push(tmp);
                } else {
                    throw new Error('Unexpected conditional');
                }
                break;

            default:
                if (!classesOnly && /[a-z]/.test(ch.val)) {
                    tmp = this.readCSSTag();
                    if (tmp.name in val.attrs) { throw new ConkittyErrors.DuplicateDecl(tmp); }
                    val.attrs[tmp.name] = tmp;
                } else {
                    this.nextChar();
                    throw new ConkittyErrors.UnexpectedSymbol(this);
                }
        }

        ch = this.nextChar(true);
    }

    return ret;
};


ConkittyParser.prototype.readCSSTag = function readCSSTag() {
    var ret = this._readName(ConkittyTypes.CSS_TAG, cssStopExpr, tagCheckExpr);
    ret.name = '';
    return ret;
};


ConkittyParser.prototype.readCSSClass = function readCSSClass() {
    return this._readName(ConkittyTypes.CSS_CLASS, cssStopExpr, cssNameCheckExpr, 1);
};


ConkittyParser.prototype.readCSSAttr = function readCSSAttr() {
    var ch,
        ret,
        name,
        val;

    ch = this.nextChar();
    ret = new ConkittyCommandPart(ConkittyTypes.CSS_ATTR, this);

    if (ch.val !== '[') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.skipWhitespaces();
    ch = this.nextChar(true);

    if (ch.EOL) {
        this.nextChar();
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    name = this._readName(ConkittyTypes.CSS_ATTR_NAME, cssStopExpr, cssNameCheckExpr);

    this.skipWhitespaces();
    ch = this.nextChar();

    if (ch.val === '=') {
        this.skipWhitespaces();
        ch = this.nextChar(true);

        if (ch.EOL) {
            throw new ConkittyErrors.UnterminatedPart(ret);
        }

        switch (ch.val) {
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
                this.nextChar();
                throw new ConkittyErrors.UnterminatedPart(ret);

            default:
                this.nextChar();
                throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.skipWhitespaces();
        ch = this.nextChar();
    }

    if (ch.val !== ']') {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    ret.name = name.value;
    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readCSSId = function readCSSId() {
    var ret = this._readName(ConkittyTypes.CSS_ID, cssStopExpr, cssNameCheckExpr, 1);
    ret.name = 'id';
    return ret;
};


ConkittyParser.prototype.readCSSBEMBlock = function readCSSBEMBlock() {
    var block,
        elem,
        ch;

    block = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr, 1);

    ch = this.nextChar();
    if (ch.val === '(') {
        this.skipWhitespaces();
        elem = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr);
        this.skipWhitespaces();

        ch = this.nextChar();
        if (ch.val !== ')') {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        block.value += '__' + elem.value;
    } else {
        this.pushBack(1);
    }

    return block;
};


ConkittyParser.prototype.readCSSBEMMod = function readCSSBEMMod(block) {
    if (!block) { throw new ConkittyErrors.UnexpectedSymbol(this); }

    var ret,
        name,
        val,
        ch;

    ch = this.nextChar();
    if (ch.val !== '{') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }
    ret = new ConkittyCommandPart(ConkittyTypes.CSS_BEM_MOD, this);

    this.skipWhitespaces();
    ch = this.nextChar(true);

    if (ch.EOL) {
        this.nextChar();
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    name = this._readName(ConkittyTypes.CSS_BEM, bemStopExpr, bemCheckExpr);

    this.skipWhitespaces();
    ch = this.nextChar();

    if (ch.val === '=') {
        this.skipWhitespaces();
        ch = this.nextChar(true);

        if (ch.EOL) {
            throw new ConkittyErrors.UnterminatedPart(ret);
        }

        switch (ch.val) {
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
                this.nextChar();
                throw new ConkittyErrors.UnterminatedPart(ret);

            default:
                this.nextChar();
                throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.skipWhitespaces();
        ch = this.nextChar();
    }

    if (ch.val !== '}') {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    ret.name = block.value + '_' + name.value;
    ret.value = val;

    return ret;
};


ConkittyParser.prototype.readCSSConditional = function readCSSConditional(classesOnly, lastBEMBlock) {
    var ret = new ConkittyCommandPart(ConkittyTypes.CSS_IF, this),
        what = this._readName(ConkittyTypes.CSS_CLASS, cssStopExpr, /^(?:if|elem)$/, 1),
        ch;

    ret.what = what.value;

    if (classesOnly && ret.what !== 'if') {
        throw new ConkittyErrors.InconsistentCommand(what);
    }

    ch = this.nextChar();
    if (ch.val !== '(') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.skipWhitespaces();
    ch = this.nextChar(true);

    switch (ch.val) {
        case '$':
            ret.cond = this.readVariable();
            break;

        case '(':
            ret.cond = this.readJS(undefined, true);
            break;

        default:
            throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.skipWhitespaces();
    ch = this.nextChar();

    if (ret.what === 'if') {
        if (ch.val !== ',') {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        this.skipWhitespaces();
        ch = this.nextChar(true);

        if (ch.val !== ',') {
            ret.positive = this.readCSS(classesOnly, lastBEMBlock);
            this.skipWhitespaces();
            ch = this.nextChar(true);
        }

        if (ch.val === ',') {
            this.nextChar();
            this.skipWhitespaces();
            ret.negative = this.readCSS(classesOnly, lastBEMBlock);
            this.skipWhitespaces();
        }

        ch = this.nextChar();
    }

    if (ch.val !== ')') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    return ret;
};


ConkittyParser.prototype.readVariable = function readVariable() {
    var ret = this._readName(ConkittyTypes.VARIABLE, variableStopExpr, variableCheckExpr, 1);
    ret.value = '$' + ret.value;
    if (ret.value === '$C') {
        throw new ConkittyErrors.IllegalName(ret, '$C is reserved');
    }
    return ret;
};


ConkittyParser.prototype.readString = function readString(noRaw) {
    var ch,
        ch2,
        closer,
        raw = false, // Indicates that string is enclosed in triple quotes.
        val = [],
        ret;

    this.inStringOrJS = true;

    ch = this.nextChar();
    if (ch.val !== '"' && ch.val !== "'") {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    ret = new ConkittyCommandPart(ConkittyTypes.STRING, this);

    closer = ch.val;

    ch = this.nextChar();
    ch2 = this.nextChar();

    if (!noRaw && ch.val === closer && ch2.val === closer) {
        raw = true;
        ch = this.nextChar();
    } else {
        this.pushBack(1);
    }

    while (!ch.EOL) {
        ch2 = this.nextChar(true);
        if (ch.val === '\\' && (ch2.val === '\\' || ch2.val === closer)) {
            val.push('\\');
            val.push(ch2.val);
            this.nextChar();
        } else {
            if (ch.val === closer) {
                break;
            }
            val.push(ch.val);
        }
        ch = this.nextChar();
    }

    if (ch.val === closer && raw) {
        ch = this.nextChar();
        ch2 = this.nextChar();
        if (ch.val !== closer || ch2.val !== closer) {
            this.pushBack(2);
            throw new ConkittyErrors.UnterminatedPart(ret);
        }
    }

    if (ch.val !== closer) {
        throw new ConkittyErrors.UnterminatedPart(ret);
    }

    ret.value = closer + val.join('') + closer;
    ret.raw = raw;

    this.inStringOrJS = false;

    return ret;
};


ConkittyParser.prototype.readJS = function readJS(indent, noRaw) {
    var ch,
        ch2,
        ch3,
        ret,
        val = [];

    this.inStringOrJS = true;

    if (!indent) {
        ch = this.nextChar();
        if (ch.val !== '(') {
            throw new ConkittyErrors.UnexpectedSymbol(this);
        }

        ret = new ConkittyCommandPart(ConkittyTypes.JAVASCRIPT, this);

        var brackets,
            inString = false,
            raw = false;

        brackets = 1;

        ch2 = this.nextChar();
        ch3 = this.nextChar();

        if (!noRaw && ch2.val === '(' && ch3.val === '(') {
            raw = true;
        } else {
            this.pushBack(2);
        }

        ch = this.nextChar();
        while (!ch.EOF) {
            if (!inString) {
                if (ch.val === '(') {
                    brackets++;
                } else if (ch.val === ')') {
                    brackets--;
                    // Avoiding this: (((   function(){})(   ))).
                    if (brackets === 0) {
                        ch2 = this.nextChar();
                        ch3 = this.nextChar();
                        if (raw && (ch2.val !== ')' || ch3.val !== ')')) {
                            this.pushBack(2);
                            brackets += 2;
                            raw = false;
                            val.unshift('((');
                        } else {
                            if (!raw) { this.pushBack(2); }
                            break;
                        }
                    }
                /* jshint -W109 */
                } else if (ch.val === '"' || ch.val === "'") {
                /* jshint +W109 */
                    inString = ch.val;
                }
            } else {
                ch2 = this.nextChar(true);
                if (ch.val === '\\' && (ch2.val === '\\' || ch2.val === inString)) {
                    val.push('\\');
                    ch = this.nextChar();
                } else if (ch.val === inString) {
                    inString = false;
                }
            }

            if (ch.val) {
                val.push(ch.val);
            } else if (ch.EOL && !ch.EOF) {
                val.push('\n');
            } else {
                break;
            }
            ch = this.nextChar();
        }

        if (ch.EOF) {
            throw new ConkittyErrors.UnterminatedPart(ret);
        }

        val = val.join('');

        if (!strip(val)) {
            throw new ConkittyErrors.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
        }

        ret.raw = raw;
        ret.expr = true;
        ret.value = val;
    } else {
        var newIndent,
            i;

        this.skipEmptyLines();
        ret = new ConkittyCommandPart(ConkittyTypes.JAVASCRIPT, this);

        while (((newIndent = this.getIndent())) > indent) {
            this.pushBack(newIndent);

            for (i = 0; i < indent; i++) {
                this.nextChar();
            }

            while (!((ch = this.nextChar())).EOL) {
                val.push(ch.val);
            }

            i = 0;
            ch2 = null;
            while (!ch.EOF && ch.EOL) {
                val.push('\n');
                i = this.skipWhitespaces();
                ch = ch2 = this.nextChar();
            }

            if (ch2 && !ch2.EOF) {
                this.pushBack(i + 1);
            }
        }

        this.pushBack(newIndent + 1);

        val = val.join('');

        ret.raw = false;
        ret.expr = false;
        ret.value = val;

        if (!strip(val)) {
            throw new ConkittyErrors.JSParseError('Empty expression', this, ret.lineAt, ret.charAt);
        }
    }

    try {
        val = (indent ? utils.parseJSFunction : utils.parseJSExpression)(val);
        if (val[1].length === 1 && val[1][0][0] === 'function') {
            // Check if function has name or arguments in use.
            ret.isFunc = val[1][0][1] || val[1][0][2].length > 0 || utils.hasReturn(val[1][0][3]);
            if (!ret.isFunc) {
                // It is just a wrapper, function name is not used, arguments,
                // are not used, and no return statement — extract just body
                // to be able to merge it with other bodies.
                val[1] = val[1][0][3];
                ret.value = utils.adjustJS(val);
            }
        } else {
            ret.isFunc = false;
        }
    } catch(e) {
        throw new ConkittyErrors.JSParseError(
            e.message,
            this,
            ret.lineAt + e.line - 2,
            (indent || e.line > 2 ? (indent || 0) - 1 : ret.charAt + (ret.raw ? 2 : 0)) + e.col
        );
    }

    this.inStringOrJS = false;

    return ret;
};


ConkittyParser.prototype.readPrecompileExpr = function readPrecompileExpr() {
    var ch,
        expr;

    this.inStringOrJS = true;

    ch = this.nextChar();
    if (ch.val !== '|') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    expr = this.readJS(undefined, true);

    ch = this.nextChar();
    if (ch.val !== '|') {
        throw new ConkittyErrors.UnexpectedSymbol(this);
    }

    this.inStringOrJS = false;

    return expr;
};


module.exports.ConkittyParser = ConkittyParser;
