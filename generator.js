/*!
 * conkitty, https://github.com/hoho/conkitty
 * Copyright 2013-2014 Marat Abdullin
 * Released under the MIT license
 */
'use strict';

var ConkittyTypes = require(__dirname + '/types.js'),
    ConkittyErrors = require(__dirname + '/errors.js'),
    utils = require(__dirname + '/utils.js'),
    parseJS = utils.parseJS,
    adjustJS = utils.adjustJS,
    fs = require('fs'),
    SourceMapGenerator = require('source-map').SourceMapGenerator,

    INDENT = '    ',

    tagFuncs = 'div|span|p|a|ul|ol|li|table|tr|td|th|br|img|b|i|s|u'.split('|');


function extend(Child, Parent) {
    var F = function() {};
    F.prototype = Parent.prototype;
    Child.prototype = new F();
    Child.prototype.constructor = Child;
    Child.superclass = Parent.prototype;
}


function conkittyMatch(value, pattern) {
    if (!value.length && !pattern.length) {
        return;
    }

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
            var error1,
                error2,
                index1,
                index2;

            error1 = conkittyMatch(value.slice(1), pattern.slice(1));
            if (error1) {
                error2 = conkittyMatch(value.slice(1), pattern);
                if (error2) {
                    // In case of both non-matches, return one with largest,
                    // index.
                    index1 = value.indexOf(error1);
                    // When index is less than zero, errorX is from pattern.
                    if (index1 < 0) { return error1; }
                    index2 = value.indexOf(error2);
                    if (index2 < 0) { return error2; }
                    return index2 < index1 ? error1 : error2;
                }
            }
            return;

        case 'shift':
            return conkittyMatch(value, pattern.slice(1));

        default:
            return value[0];
    }
}


function ConkittyPatternPart(parts, count) {
    this.count = count;
    this.candidates = {};
    this.src = parts[0].src;
    this.lineAt = parts[parts.length - 1].lineAt;
    this.charAt = parts[parts.length - 1].charAt;

    for (var i = 2; i < arguments.length; i += 2) {
        if (arguments[i]) {
            this.candidates[arguments[i]] = arguments[i + 1];
        }
    }
}


ConkittyPatternPart.prototype.match = function match(part) {
    var m = this.candidates[part.type],
        ret;

    if (m === null || (m && (m === part.value))) {
        if (this.count === '*') {
            ret = 'both';
        } else {
            this.count--;
            ret = this.count > 0 ? 'stay' : 'next';
        }
    } else {
        if (this.count === '*') {
            ret = 'shift';
        } else {
            ret = false;
        }
    }

    return ret;
};


function conkittyGetValuePatternPart(cmd, count, noPayload) {
    return new ConkittyPatternPart(cmd.value, count,
        ConkittyTypes.VARIABLE, null,
        ConkittyTypes.JAVASCRIPT, null,
        ConkittyTypes.STRING, null,
        noPayload ? undefined : ConkittyTypes.COMMAND_NAME, noPayload ? undefined : 'PAYLOAD'
    );
}


function ConkittyCodeBuilder(withSourceMap) {
    this.code = [];
    this.line = '';
    if (withSourceMap) {
        this.sourceMap = new SourceMapGenerator();
    }
}


ConkittyCodeBuilder.prototype.write = function(code, part) {
    if (code && this.line.length === 0 && this.indent) {
        this.line = this.indent;
    }

    if (part && this.sourceMap) {
        this.sourceMap.addMapping({
            generated: {
                line: this.code.length + 1,
                column: this.line.length + 1
            },
            source: part.src.filename,
            original: {
                line: part.lineAt + 1,
                column: part.charAt + 1
            }
        });
    }

    code = (code || '').split('\n');

    if (code.length > 1) {
        for (var i = 0; i < code.length - 1; i++) {
            this.writeln(code[i], undefined, true);
        }
        this.write(code[code.length - 1]);
    } else {
        this.line += code[0];
    }
};


ConkittyCodeBuilder.prototype.writeln = function(code, part, keepEmpty) {
    this.write(code, part);
    if (this.line.trim() || keepEmpty) {
        this.code.push(this.line);
    }
    this.line = '';
};


ConkittyCodeBuilder.prototype.getCurrentIndent = function() {
    return this.indent;
};


ConkittyCodeBuilder.prototype.setCurrentIndent = function(indent) {
    this.indent = indent;
};


ConkittyCodeBuilder.prototype.getCode = function() {
    var ret = this.code.slice(0);
    if (this.line.trim()) { ret.push(this.line); }
    return ret.join('\n');
};


ConkittyCodeBuilder.prototype.getSourceMap = function() {
    return this.sourceMap && this.sourceMap.toString();
};


function ConkittyGeneratorNode(parent, hasEnd) {
    this.parent = parent;
    this.root = parent && parent.root ? parent.root : parent;
    this.children = [];
    this.next = this.prev = null;
    this.ends = hasEnd ? 1 : 0;
}


ConkittyGeneratorNode.prototype.addVariable = function addVariable(part) {
    var root = (this.root || this);
    if (part.value in root.args) {
        throw new ConkittyErrors.IllegalName(part, 'duplicates argument name');
    }
    root.vars[part.value] = true;
};


ConkittyGeneratorNode.prototype.addCall = function addCall(namespace, name) {
    var cur,
        root = this.root || this;
    if (!((cur = root.calls[namespace]))) {
        cur = root.calls[namespace] = {};
    }
    cur[name] = true;
};


ConkittyGeneratorNode.prototype.addInclude = function addInclude(part) {
    (this.root || this).includes[part.value] = part;
};


ConkittyGeneratorNode.prototype.canAbsorb = function canAbsorb() {
    return false;
};


ConkittyGeneratorNode.prototype.appendChild = function appendChild(child) {
    if (this.children.length) {
        var prev = this.children[this.children.length - 1];

        if (prev.canAbsorb(child)) {
            prev.absorb(child);
        } else {
            prev.next = child;
            child.prev = prev;
        }
    }

    if (child) {
        this.children.push(child);
    }
};


ConkittyGeneratorNode.prototype.getVarName = function getVarName(name) {
    return (this.root || this).names[name];
};


ConkittyGeneratorNode.prototype.getTemplateArgDecls = function getTemplateArgDecls(part) {
    var ret = (this.root || this).generator.templates[part.namespace || ''];
    if (ret && ((ret = ret[part.value]))) {
        return ret.args;
    } else {
        throw new ConkittyErrors.UnknownPart(part);
    }
};


function ConkittyGeneratorTemplate(cmd, names, generator) {
    ConkittyGeneratorTemplate.superclass.constructor.call(this, null, true);

    this.names = names;
    this.generator = generator;

    this.args = {};
    this.vars = {};

    this.namespace = cmd[0].namespace;
    this.name = cmd[0].value;

    this.calls = {};
    this.includes = {};
}


function ConkittyGeneratorElement(parent) {
    ConkittyGeneratorElement.superclass.constructor.call(this, parent, true);
}


function ConkittyGeneratorCommand(parent, hasEnd) {
    ConkittyGeneratorCommand.superclass.constructor.call(this, parent, hasEnd);
}


function ConkittyGeneratorValue(parent) {
    ConkittyGeneratorValue.superclass.constructor.call(this, parent);
}


function ConkittyGeneratorAction(parent) {
    ConkittyGeneratorAction.superclass.constructor.call(this, parent);
}


extend(ConkittyGeneratorTemplate, ConkittyGeneratorNode);
extend(ConkittyGeneratorElement, ConkittyGeneratorNode);
extend(ConkittyGeneratorCommand, ConkittyGeneratorNode);
extend(ConkittyGeneratorValue, ConkittyGeneratorNode);
extend(ConkittyGeneratorAction, ConkittyGeneratorNode);


ConkittyGeneratorValue.prototype.canAbsorb = function absorb(val) {
    return (val instanceof ConkittyGeneratorValue) &&
        (this.raw === val.raw) &&
        !this.isFunc &&
        !val.isFunc;
};


/* jshint -W098 */
ConkittyGeneratorValue.prototype.absorb = function absorb(val) {
    //console.log(val);
};


ConkittyGeneratorAction.prototype.canAbsorb = function absorb(act) {
    return (act instanceof ConkittyGeneratorAction) &&
        !this.isFunc &&
        !act.isFunc;
};


ConkittyGeneratorAction.prototype.absorb = function absorb(act) {
    //console.log(act);
};


function getAnonymousFunctionName(node, part) {
    return '$C_' + node.root.name.replace(/\-/g, '_') + '_' + (part.lineAt + 1) + '_' + (part.charAt + 1);
}


function assertNoChildren(cmd) {
    if (cmd.children.length) {
        throw new ConkittyErrors.InconsistentCommand(cmd.children[0].value[0]);
    }
}


function getExpressionString(node, val, wrap) {
    var ret,
        isVar;

    switch (val.type) {
        /* jshint -W086 */
        case ConkittyTypes.VARIABLE:
            if (!(val.value in node.root.args || val.value in node.root.vars)) {
                throw new ConkittyErrors.UnknownPart(val);
            }
            isVar = true;

        case ConkittyTypes.JAVASCRIPT:
        /* jshint +W086 */
            ret = [];
            if (wrap) {
                if (val.isFunc) {
                    if (!isVar) { ret.push('('); }
                    ret.push(val.value);
                    if (!isVar) { ret.push(')'); }
                } else {
                    ret.push('function ');
                    ret.push(getAnonymousFunctionName(node, val));
                    ret.push('() { return ');

                    if (!isVar) { ret.push('('); }
                    ret.push(val.value);
                    if (!isVar) { ret.push(')'); }

                    ret.push('; }');
                }
            } else {
                if (!isVar) { ret.push('('); }
                ret.push(val.value);
                if (!isVar) { ret.push(')'); }
                if (val.isFunc) { ret.push('.apply(this, arguments)'); }
            }

            return ret.join('');

        case ConkittyTypes.STRING:
            ret = [];
            ret.push(JSON.stringify(utils.evalString(val.value)));
            return ret.join('');

        /* jshint -W086 */
        case ConkittyTypes.COMMAND_NAME:
            if (val.value === 'PAYLOAD') {
                ret = [];
                if (wrap) { ret.push('function() { return '); }
                ret.push(node.getVarName('env'));
                ret.push('.l()');
                if (wrap) { ret.push('; }'); }
                return ret.join('');
            }

        default:
        /* jshint +W086 */
            throw new ConkittyErrors.InconsistentCommand(val);
    }

}


function getEnds(node, force) {
    if (node.ends) {
        if (node.next || !node.root || !node.parent || !node.parent.ends || force) {
            return '.end(' + (node.ends > 1 ? node.ends : '') + ')';
        }

        node.parent.ends += node.ends;
        node.ends = 0;
    }

    return '';
}


function getExistingAttrs(css, ret) {
    if (!css) { return; }
    css = css.value;

    var i;

    if (ret === undefined) { ret = {}; }

    if (Object.keys(css.classes)) { ret['class'] = true; }
    for (i in css.attrs) { ret[i] = true; }

    for (i = 0; i < css.ifs.length; i++) {
        getExistingAttrs(css.ifs[i].positive, ret);
        getExistingAttrs(css.ifs[i].negative, ret);
    }

    if (css.names.length) { ret[''] = true; }

    return ret;
}


function getAttrsByCSS(node, css) {
    if (!css) { return {}; }

    var hasAttrs = getExistingAttrs(css),
        classes,
        exprs,
        curRet = {},
        ifsRet = {},
        ret = {},
        cur,
        positive,
        negative,
        i,
        j;

    css = css.value;

    for (i in hasAttrs) {
        if ((cur = css.attrs[i])) {
            if (cur.name !== i) {
                // This thing should never happen.
                throw new Error('Wrong name');
            }

            switch (cur.type) {
                case ConkittyTypes.CSS_TAG:
                    curRet[i] = {plain: true, value: cur.value};
                    break;

                case ConkittyTypes.CSS_ID:
                    curRet[i] = {plain: true, value: cur.value};
                    break;

                case ConkittyTypes.CSS_ATTR:
                    if (cur.value) {
                        switch (cur.value.type) {
                            case ConkittyTypes.STRING:
                                curRet[i] = {plain: true, value: utils.evalString(cur.value.value)};
                                break;

                            case ConkittyTypes.JAVASCRIPT:
                            case ConkittyTypes.VARIABLE:
                                curRet[i] = {plain: false, value: getExpressionString(node, cur.value, false)};
                                break;

                            default:
                                throw new ConkittyErrors.InconsistentCommand(cur.value);
                        }
                    } else {
                        curRet[i] = {plain: true, value: i};
                    }
                    break;

                default:
                    throw new ConkittyErrors.InconsistentCommand(cur);
            }
        } else {
            curRet[i] = null;
        }

        if (i === 'class') {
            exprs = [];
            classes = [];
            for (j in css.classes) {
                cur = css.classes[j];
                switch (cur.type) {
                    case ConkittyTypes.CSS_CLASS:
                    case ConkittyTypes.CSS_BEM:
                        classes.push(cur.value);
                        break;

                    case ConkittyTypes.CSS_BEM_MOD:
                        if (cur.value) {
                            switch (cur.value.type) {
                                case ConkittyTypes.STRING:
                                    classes.push(cur.name + '_' + utils.evalString(cur.value.value));
                                    break;

                                case ConkittyTypes.JAVASCRIPT:
                                case ConkittyTypes.VARIABLE:
                                    exprs.push(node.getVarName('getModClass') + '(' + JSON.stringify(cur.name) + ', ' + getExpressionString(node, cur.value, false) + ')');
                                    break;

                                default:
                                    throw new ConkittyErrors.InconsistentCommand(cur.value);
                            }
                        } else {
                            classes.push(cur.name);
                        }
                        break;

                    default:
                        throw new ConkittyErrors.InconsistentCommand(cur);
                }
            }

            cur = curRet['class'];
            if (cur) {
                if (cur.plain) {
                    classes.push(cur.value);
                } else {
                    exprs.push(cur.value);
                }
            }

            classes = classes.length ? classes.join(' ') : '';

            if (exprs.length) {
                if (classes) {
                    exprs.unshift(JSON.stringify(classes));
                }

                curRet['class'] = {plain: false, value: node.getVarName('joinClasses') + '(' + exprs.join(', ') + ')'};
            } else if (classes) {
                curRet['class'] = {plain: true, value: classes};
            }
        }
    }

    exprs = css.names.map(function(name) { return getExpressionString(node, name.cond, false); });
    if (exprs.length) {
        if ((j = curRet[''])) {
            exprs.unshift(j.plain ? JSON.stringify(j.value) : j.value);
        }

        curRet[''] = {plain: false, value: exprs.reverse().join(' || ')};
    }

    for (i = 0; i < css.ifs.length; i++) {
        positive = getAttrsByCSS(node, css.ifs[i].positive);
        negative = getAttrsByCSS(node, css.ifs[i].negative);

        for (j in curRet) {

            if ((j in positive) || (j in negative)) {
                cur = [];
                cur.push('(');
                cur.push(getExpressionString(node, css.ifs[i].cond, false));
                cur.push(' ? ');
                if (j in positive) {
                    if (positive[j].plain) { cur.push(JSON.stringify(positive[j].value)); }
                    else { cur.push(positive[j].value); }
                } else {
                    cur.push('undefined');
                }
                cur.push(' : ');
                if (j in negative) {
                    if (negative[j].plain) { cur.push(JSON.stringify(negative[j].value)); }
                    else { cur.push(negative[j].value); }
                } else {
                    cur.push('undefined');
                }
                cur.push(')');
                cur = cur.join('');

                if (!(j in ifsRet)) { ifsRet[j] = []; }
                if (j === 'class') {
                    ifsRet[j].push({plain: false, value: cur});
                } else {
                    ifsRet[j].unshift({plain: false, value: cur});
                }
            }
        }
    }

    for (j in curRet) {
        cur = j in ifsRet ? ifsRet[j] : [];
        if (curRet[j] !== null) {
            if (j === 'class') {
                cur.unshift(curRet[j]);
            } else {
                cur.push(curRet[j]);
            }
        }

        if (cur.length) {
            if (cur.length === 1) {
                ret[j] = cur[0];
            } else {
                cur = cur.map(function (val) {
                    return val.plain ? JSON.stringify(val.value) : val.value;
                });

                if (j === 'class') {
                    ret[j] = {plain: false, value: node.getVarName('joinClasses') + '(' + cur.join(', ') + ')'};
                } else {
                    ret[j] = {plain: false, value: cur.join(' || ')};
                }
            }
        }
    }

    return ret;
}


function processSubcommands(parent, cmd) {
    var subCommands = cmd.children,
        i = 0;

    while (i < subCommands.length) {
        i = process(parent, i, subCommands);
    }
}


function processAttr(parent, isCommand, cmd) {
    var node,
        error = conkittyMatch(
            cmd.value,
            isCommand ?
                [
                    new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'ATTR'),
                    conkittyGetValuePatternPart(cmd, 2, true)
                ]
                :
                [
                    new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.ATTR, null)
                ]
        );

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
    assertNoChildren(cmd);

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    error = parent;
    while (error && !(error instanceof ConkittyGeneratorElement)) {
        error = error.parent;
    }
    if (!error) { throw new ConkittyErrors.InconsistentCommand(cmd.value[0]); }

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.attr(');

        if (isCommand) {
            builder.write(getExpressionString(node, cmd.value[1], true), cmd.value[1]);
        } else {
            builder.write(JSON.stringify(cmd.value[0].name), cmd.value[0]);
        }

        builder.write(', ');

        if (isCommand) {
            builder.write(getExpressionString(node, cmd.value[2], true), cmd.value[2]);
        } else {
            var val = cmd.value[0].value,
                wrap;

            switch (cmd.value[0].mode) {
                case 'replace':
                    wrap = true;
                    break;

                case 'add':
                case 'remove':
                    wrap = false;
                    builder.write('function() { return ');
                    builder.write(parent.getVarName('getChangedClass'));
                    builder.write('(this, ');
                    break;

                default:
                    throw new Error('Unknown mode');
            }

            if (val.type === ConkittyTypes.CSS) {
                // Is is `class` attribute modification.
                val = getAttrsByCSS(node, val)['class'];
                if (val.plain) {
                    builder.write(JSON.stringify(val.value), cmd.value[0]);
                } else {
                    val.type = ConkittyTypes.JAVASCRIPT;
                    val.lineAt = cmd.value[0].lineAt;
                    val.charAt = cmd.value[0].charAt;
                    val.src = cmd.value[0].src;
                    builder.write(getExpressionString(node, val, wrap), val);
                }
            } else {
                builder.write(getExpressionString(node, val, wrap), val);
            }

            if (!wrap) {
                if (cmd.value[0].mode === 'remove') { builder.write(', true'); }
                builder.write('); }');
            }
        }

        builder.writeln(')');
    };

    return 1;
}


function writeCallArguments(builder, part, node, args, withAS) {
    var i,
        j,
        argNames = part ? Object.keys(node.getTemplateArgDecls(part)) : [],
        kwArgs = [],
        maxi = args.length - (withAS ? 2 : 0);

    for (i = 0; i < maxi; i++) {
        if (args[i].type === ConkittyTypes.ARGUMENT_VAL) { break; }
        argNames.shift();
        builder.write(', ');
        builder.write(getExpressionString(node, args[i], false), args[i]);
    }

    for (i; i < maxi; i++) {
        if (args[i].type !== ConkittyTypes.ARGUMENT_VAL ||
            ((j = argNames.indexOf(args[i].name))) < 0)
        {
            throw new ConkittyErrors.InconsistentCommand(args[i]);
        }

        kwArgs[j] = args[i].value;
        argNames[j] = null;
    }

    for (i = 0; i < kwArgs.length; i++) {
        builder.write(', ');
        if (kwArgs[i] === undefined) {
            builder.write('undefined');
        } else {
            builder.write(getExpressionString(node, kwArgs[i], false), kwArgs[i]);
        }
    }
}


function getCallPattern(cmd, startsWithCALL, withAS) {
    var ret = [];

    if (startsWithCALL) {
        ret.push(new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'CALL'));
        ret.push(new ConkittyPatternPart(cmd.value, 1,
            ConkittyTypes.TEMPLATE_NAME, null,
            ConkittyTypes.JAVASCRIPT, null,
            ConkittyTypes.VARIABLE, null
        ));
    } else {
        ret.push(new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.TEMPLATE_NAME, null));
    }

    ret.push(conkittyGetValuePatternPart(cmd, '*'));
    ret.push(new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_VAL, null));

    if (withAS) {
        ret.push(new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'AS'));
        ret.push(new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null));
    }

    return ret;
}


function processCall(parent, startsWithCALL, cmd, except) {
    var error,
        offset,
        name,
        node,
        callNode,
        tryNode,
        catchNode,
        payloadNode,
        exceptNode,
        args,
        asVar;

    if (startsWithCALL) {
        error = conkittyMatch(cmd.value, getCallPattern(cmd, true, false));
        if (error) {
            error = conkittyMatch(cmd.value, getCallPattern(cmd, true, true));
            if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
            asVar = cmd.value[cmd.value.length - 1];
        }

        offset = 1;
        if (except &&
            except.value[0].type === ConkittyTypes.COMMAND_NAME &&
            except.value[0].value === 'EXCEPT')
        {
            error = conkittyMatch(except.value, [new ConkittyPatternPart(except.value, 1, ConkittyTypes.COMMAND_NAME, 'EXCEPT')]);
            if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

            offset++;
        } else {
            except = null;
        }

        name = cmd.value[1];
    } else {
        error = conkittyMatch(cmd.value, getCallPattern(cmd, false, false));
        if (error) {
            error = conkittyMatch(cmd.value, getCallPattern(cmd, false, true));
            if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
            asVar = cmd.value[cmd.value.length - 1];
        }

        offset = 1;

        name = cmd.value[0];
    }

    if (name.type === ConkittyTypes.TEMPLATE_NAME) {
        parent.addCall(name.namespace, name.value);
    }

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    if (except) {
        tryNode = new ConkittyGeneratorCommand(node, false);
        catchNode = new ConkittyGeneratorCommand(node, false);
        node.appendChild(tryNode);
        node.appendChild(catchNode);

        if (except.children.length) {
            exceptNode = new ConkittyGeneratorCommand(catchNode, true);
            catchNode.appendChild(exceptNode);
        }
    }

    callNode = new ConkittyGeneratorCommand(tryNode || node, false);
    if (tryNode) { tryNode.appendChild(callNode); }
    else { node.appendChild(callNode); }

    if (cmd.children.length) {
        payloadNode = new ConkittyGeneratorCommand(tryNode || node, true);
        callNode.appendChild(payloadNode);
    }


    node.getCodeBefore = function getCodeBefore(builder) {
        builder.writeln('.act(function() {');
    };

    node.getCodeAfter = function getCodeAfter(builder) {
        builder.writeln('})');
    };

    if (asVar) {
        callNode.addVariable(asVar);
    }

    callNode.getCodeBefore = function getCodeBefore(builder) {
        if (asVar) {
            builder.write(asVar.value, asVar);
            builder.write(' = ');
        }

        builder.write('$C.');
        if (name.namespace) { builder.write('_'); }
        builder.write('tpl[');

        if (name.type === ConkittyTypes.TEMPLATE_NAME) {
            builder.write(JSON.stringify((name.namespace ? name.namespace + '::' : '') + name.value), name);
        } else {
            builder.write(getExpressionString(node, name, false), name);
        }

        builder.write('].call(new ');
        builder.write(node.getVarName('EnvClass'));
        builder.write('(');
        if (payloadNode) {
            builder.writeln('');
            builder.write(INDENT);
        }
        builder.write('this');
        if (payloadNode) {
            builder.write(',');
        } else {
            builder.write(')');
            writeCallArguments(
                builder,
                name.type === ConkittyTypes.TEMPLATE_NAME ? name : null,
                callNode,
                cmd.value.slice(startsWithCALL ? 2 : 1),
                asVar
            );
            builder.write(');');
        }

        builder.writeln('');
    };

    if (payloadNode) {
        callNode.getCodeAfter = function getCodeAfter(builder) {
            builder.write(')');
            writeCallArguments(
                builder,
                name.type === ConkittyTypes.TEMPLATE_NAME ? name : null,
                callNode,
                cmd.value.slice(startsWithCALL ? 2 : 1),
                asVar
            );
            builder.writeln(');');
        };

        payloadNode.extraIndent = 1;

        payloadNode.getCodeBefore = function getCodeBefore(builder) {
            builder.writeln('function() {');
            builder.write(INDENT);
            builder.writeln('return $C()');
        };

        payloadNode.getCodeAfter = function getCodeAfter(builder) {
            builder.write(INDENT);
            builder.write(getEnds(payloadNode, true));
            builder.writeln('; }');
        };

        processSubcommands(payloadNode, cmd);
    }

    if (tryNode) {
        tryNode.getCodeBefore = function getCodeBefore(builder) {
            builder.writeln('try {');
        };

        tryNode.getCodeAfter = function getCodeAfter(builder) {
            builder.writeln('} catch($C_e) {');
        };

        catchNode.getCodeAfter = function getCodeAfter(builder) {
            builder.writeln('}');
        };
    }

    if (exceptNode) {
        exceptNode.getCodeBefore = function getCodeBefore(builder) {
            builder.writeln('$C(this)');
        };

        exceptNode.getCodeAfter = function getCodeAfter(builder) {
            builder.write(getEnds(exceptNode, true));
            builder.writeln(';');
        };

        processSubcommands(exceptNode, except);
    }

    return offset;
}


function processChoose(parent, cmd) {
    var choose,
        error,
        i;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'CHOOSE')]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    if (cmd.children.length) {
        choose = new ConkittyGeneratorCommand(parent, true);
        parent.appendChild(choose);
        choose.getCodeBefore = function getCodeBefore(builder) { builder.writeln('.choose()', cmd.value[0]); };
        choose.getCodeAfter = function getCodeAfter(builder) { builder.writeln(getEnds(choose)); };

        for (i = 0; i < cmd.children.length; i++) {
            (function(subcmd) {
                error = conkittyMatch(subcmd.value, [
                    new ConkittyPatternPart(subcmd.value, 1, ConkittyTypes.COMMAND_NAME, 'WHEN'),
                    conkittyGetValuePatternPart(subcmd, 1)
                ]);

                var node = new ConkittyGeneratorCommand(choose, true);
                choose.appendChild(node);

                if (error) {
                    error = conkittyMatch(subcmd.value, [new ConkittyPatternPart(subcmd.value, 1, ConkittyTypes.COMMAND_NAME, 'OTHERWISE')]);
                    if (!error && cmd.children[i + 1]) { error = cmd.children[i + 1].value[0]; }
                    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
                    // It is OTHERWISE.
                    node.getCodeBefore = function getCodeBefore(builder) { builder.writeln('.otherwise()', subcmd.value[0]); };
                    node.getCodeAfter = function getCodeAfter(builder) { builder.writeln(getEnds(node)); };
                } else {
                    // It is WHEN.
                    node.getCodeBefore = function getCodeBefore(builder) {
                        builder.write('.when(', subcmd.value[0]);
                        builder.write(getExpressionString(node, subcmd.value[1], true), subcmd.value[1]);
                        builder.writeln(')');
                    };

                    node.getCodeAfter = function getCodeAfter(builder) {
                        builder.writeln(getEnds(node));
                    };
                }

                processSubcommands(node, subcmd);
            })(cmd.children[i]);
        }
    }

    return 1;
}


function processEach(parent, cmd) {
    var node,
        error,
        key,
        val,
        arr;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'EACH'),
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.JAVASCRIPT, null, ConkittyTypes.VARIABLE, null)
    ]);

    if (error) {
        error = conkittyMatch(cmd.value, [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'EACH'),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.JAVASCRIPT, null, ConkittyTypes.VARIABLE, null)
        ]);

        if (error) {
            error = conkittyMatch(cmd.value, [
                new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'EACH'),
                new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null),
                new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null),
                new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.JAVASCRIPT, null, ConkittyTypes.VARIABLE, null)
            ]);

            if (error) {
                throw new ConkittyErrors.InconsistentCommand(error);
            } else {
                key = cmd.value[1];
                val = cmd.value[2];
                arr = cmd.value[3];
            }
        } else {
            val = cmd.value[1];
            arr = cmd.value[2];
        }
    } else {
        arr = cmd.value[1];
    }

    node = new ConkittyGeneratorCommand(parent, true);
    parent.appendChild(node);

    if (key) { node.addVariable(key); }
    if (val) { node.addVariable(val); }

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.each(', cmd.value[0]);
        builder.write(getExpressionString(node, arr, true), arr);
        builder.write(')');
        if (key || val) {
            builder.writeln('');
            builder.write(INDENT);
            builder.write('.act(function($C_');
            if (key) { builder.write(', $C__'); }
            builder.write(') { ');
            if (val) {
                builder.write(val.value, val);
                builder.write(' = $C_; ');
            }
            if (key) {
                builder.write(key.value, key);
                builder.write(' = $C__; ');
            }
            builder.write('})');
        }
        builder.writeln('');
    };

    node.getCodeAfter = function getCodeAfter(builder) {
        builder.writeln(getEnds(node));
    };

    processSubcommands(node, cmd);

    return 1;
}


function processJS(parent, cmd) {
    var node;

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        var args = cmd.value[0].args,
            i;

        builder.write('.act(function(', cmd.value[0]);
        for (i = 0; i < args.length; i++) {
            if (i > 0) { builder.write(', '); }
            builder.write(args[i].value, args[i]);
        }

        builder.write(') {');

        if (cmd.value[0].retMaker) {
            builder.write(' ');
            builder.write(cmd.value[0].retMaker);
            builder.write(' = (function() {');
        }

        builder.writeln('');
        builder.write(cmd.value[0].js.value, cmd.value[0].js);
        builder.writeln('');

        if (cmd.value[0].retMaker) {
            builder.write('}).call(this); ');
        }

        builder.writeln('})');
    };

    return 1;
}


function processExpose(parent, cmd) {
    var node,
        error,
        retVarName = parent.getVarName('ret');

    if (parent.root) {
        throw new ConkittyErrors.InconsistentCommand(cmd.value[0]);
    }

    if (parent.hasRetMaker) {
        throw new ConkittyErrors.DuplicateDecl(cmd.value[0]);
    }

    parent.hasRetMaker = true;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'EXPOSE'),
        conkittyGetValuePatternPart(cmd, 1)
    ]);

    if (error) {
        error = conkittyMatch(cmd.value, [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'EXPOSE'),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'JS')
        ]);

        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

        cmd.value[1].retMaker = retVarName;
        cmd.value.shift();

        return processJS(parent, cmd);
    }

    assertNoChildren(cmd);

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.act(function() { ', cmd.value[0]);
        builder.write(retVarName);
        builder.write(' = ');
        builder.write(getExpressionString(node, cmd.value[1], false), cmd.value[1]);
        builder.writeln('; })');
    };

    return 1;
}


function processMem(parent, cmd) {
    var node,
        error,
        expr;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'MEM'),
        conkittyGetValuePatternPart(cmd, 1)
    ]);

    if (error) {
        error = conkittyMatch(cmd.value, [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'MEM'),
            conkittyGetValuePatternPart(cmd, 2)
        ]);

        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

        expr = cmd.value[2];
    }

    assertNoChildren(cmd);

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.mem(', cmd.value[0]);
        builder.write(getExpressionString(node, cmd.value[1], true), cmd.value[1]);
        if (expr) {
            builder.write(', ');
            builder.write(getExpressionString(node, expr, true), expr);
        }
        builder.writeln(')');
    };

    return 1;
}


function processPayload(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'PAYLOAD')
    ]);

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    assertNoChildren(cmd);

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.act(function() { ', cmd.value[0]);
        builder.write(node.getVarName('env'));
        builder.writeln('.l(this); })');
    };

    return 1;
}


function processSet(parent, cmd) {
    var pattern1 = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'SET'),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null)
        ],
        pattern2 = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'SET'),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null),
            conkittyGetValuePatternPart(cmd, 1)
        ],

        error1 = conkittyMatch(cmd.value, pattern1),
        error2,
        node,
        name;

    if (error1) { error2 = conkittyMatch(cmd.value, pattern2); }
    if (error1 && error2) { throw new ConkittyErrors.InconsistentCommand(error1); }
    if (error1) { assertNoChildren(cmd); }

    node = new ConkittyGeneratorCommand(parent, !error1);
    parent.appendChild(node);
    name = cmd.value[1].value;
    node.addVariable(cmd.value[1]);

    if (error1) {
        node.getCodeBefore = function getCodeBefore(builder) {
            builder.write('.act(function ', cmd.value[0]);
            builder.write(getAnonymousFunctionName(node, cmd.value[0]));
            builder.write('() { ');
            builder.write(name, cmd.value[1]);
            builder.write(' = ');
            builder.write(getExpressionString(node, cmd.value[2], false), cmd.value[2]);
            builder.writeln('; })');
        };
    } else if (cmd.children.length) {
        node.extraIndent = 1;
        node.getCodeBefore = function getCodeBefore(builder) {
            builder.write('.act(function ', cmd.value[0]);
            builder.write(getAnonymousFunctionName(node, cmd.value[0]));
            builder.writeln('() {');
            builder.write(INDENT);
            builder.write(name, cmd.value[1]);
            builder.writeln(' = $C()');
        };

        node.getCodeAfter = function getCodeAfter(builder) {
            builder.write(INDENT);
            builder.write(getEnds(node));
            builder.writeln(';');
            builder.write(INDENT);
            builder.write(name);
            builder.write(' = ');
            builder.write(name);
            builder.write('.firstChild ? ');
            builder.write(name);
            builder.writeln(' : undefined;');
            builder.writeln('})');
        };
    }

    processSubcommands(node, cmd);

    return 1;
}


function processTest(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'TEST'),
        conkittyGetValuePatternPart(cmd, 1)
    ]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    if (cmd.children.length) {
        node = new ConkittyGeneratorCommand(parent, true);
        parent.appendChild(node);

        node.getCodeBefore = function getCodeBefore(builder) {
            builder.write('.test(', cmd.value[0]);
            builder.write(getExpressionString(node, cmd.value[1], true), cmd.value[1]);
            builder.writeln(')');
        };

        node.getCodeAfter = function getCodeAfter(builder) {
            builder.writeln(getEnds(node));
        };
    }

    processSubcommands(node, cmd);

    return 1;
}


function processTrigger(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'TRIGGER'),
        conkittyGetValuePatternPart(cmd, '*')
    ]);

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    assertNoChildren(cmd);

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.trigger(', cmd.value[0]);
        for (var i = 1; i < cmd.value.length; i++) {
            if (i > 1) { builder.write(', '); }
            builder.write(getExpressionString(node, cmd.value[i], true), cmd.value[i]);
        }
        builder.writeln(')');
    };

    return 1;
}


function processWith(parent, cmd, otherwise) {
    var node,
        error,
        name,
        hasElse,
        okNode,
        elseNode;

    error = conkittyMatch(cmd.value, [
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'WITH'),
        new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null),
        conkittyGetValuePatternPart(cmd, 1)
    ]);

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    if (otherwise && conkittyMatch(otherwise.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'ELSE')])) {
        otherwise = null;
    }

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    name = cmd.value[1].value;
    node.addVariable(cmd.value[1]);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.act(function() { try { ', cmd.value[0]);
        builder.write(name, cmd.value[1]);
        builder.write(' = ');
        builder.write(getExpressionString(node, cmd.value[2], false), cmd.value[2]);
        builder.write('; } catch($C_e) { ');
        builder.write(name);
        builder.writeln(' = undefined; }})');
    };

    hasElse = otherwise && otherwise.children.length;

    if (cmd.children.length || hasElse) {
        okNode = new ConkittyGeneratorCommand(parent, false);
        okNode.extraIndent = 1;
        okNode.ends = hasElse ? 1 : 2;

        parent.appendChild(okNode);

        okNode.getCodeBefore = function getCodeBefore(builder) {
            builder.writeln('.choose()', cmd.value[0]);
            builder.write(INDENT);
            builder.write('.when(function() { return ');
            builder.write(name);
            builder.write(' !== undefined && ');
            builder.write(name);
            builder.writeln(' !== null; })');
        };

        okNode.getCodeAfter = function getCodeAfter(builder) {
            if (hasElse) { builder.write(INDENT); }
            builder.writeln(getEnds(okNode));
        };

        processSubcommands(okNode, cmd);
    }

    if (hasElse) {
        elseNode = new ConkittyGeneratorCommand(parent);
        elseNode.ends = 2;
        elseNode.extraIndent = 1;

        parent.appendChild(elseNode);

        elseNode.getCodeBefore = function getCodeBefore(builder) {
            builder.write(INDENT);
            builder.writeln('.otherwise()', otherwise.value[0]);
        };

        elseNode.getCodeAfter = function getCodeAfter(builder) {
            builder.writeln(getEnds(elseNode));
        };

        processSubcommands(elseNode, otherwise);
    }

    return otherwise ? 2 : 1;
}


function processVariable(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null)]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
    assertNoChildren(cmd);

    node = new ConkittyGeneratorValue(parent);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.text(');
        builder.write(getExpressionString(node, cmd.value[0], true), cmd.value[0]);
        builder.writeln(')');
    };

    return 1;
}


function processJavascript(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.JAVASCRIPT, null)]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
    assertNoChildren(cmd);

    node = new ConkittyGeneratorValue(parent);
    parent.appendChild(node);

    if (cmd.value[0].raw) {
        node.getCodeBefore = function getCodeBefore(builder) {
            builder.writeln('.act(function ' + getAnonymousFunctionName(node, cmd.value[0]) + '($C_) {');
            builder.write(INDENT);
            builder.write('if ((');
            builder.write('$C_ = ' + getExpressionString(node, cmd.value[0], false), cmd.value[0]);
            builder.writeln(') instanceof Node) { this.appendChild($C_); }');
            builder.write(INDENT);
            builder.writeln('else { $C(this).text($C_, true).end(); }');
            builder.writeln('})');
        };
    } else {
        node.getCodeBefore = function getCodeBefore(builder) {
            builder.write('.text(');
            builder.write(getExpressionString(node, cmd.value[0], true), cmd.value[0]);
            builder.writeln(')');
        };
    }

    return 1;
}


function processString(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.STRING, null)]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
    assertNoChildren(cmd);

    node = new ConkittyGeneratorValue(parent);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.write('.text(');
        builder.write(getExpressionString(node, cmd.value[0], false), cmd.value[0]);
        if (cmd.value[0].raw) { builder.write(', true'); }
        builder.writeln(')');
    };

    return 1;
}


function processElement(parent, cmd) {
    var node,
        error,
        elemVar;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.CSS, null)]);
    if (error) {
        error = conkittyMatch(cmd.value, [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.CSS, null),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'AS'),
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.VARIABLE, null)
        ]);
        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }
        elemVar = cmd.value[2];
    }

    node = new ConkittyGeneratorElement(parent);
    parent.appendChild(node);

    if (elemVar) { node.addVariable(elemVar); }

    node.getCodeBefore = function getCodeBefore(builder) {
        var tag,
            tmp,
            i,
            plain,
            attrs,
            tagFunc;

        tmp = getAttrsByCSS(node, cmd.value[0]);
        tag = tmp[''];
        delete tmp[''];
        if (!tag) { tag = {plain: true, value: 'div'}; }

        plain = true;
        attrs = [];
        for (i in tmp) {
            if (attrs.length) { attrs.push(', '); }
            attrs.push(JSON.stringify(i));
            attrs.push(': ');
            if (tmp[i].plain) { attrs.push(JSON.stringify(tmp[i].value)); }
            else { plain = false; attrs.push(tmp[i].value); }
        }

        if (attrs.length) {
            attrs.unshift('{');
            attrs.push('}');

            if (!plain) {
                attrs.unshift('() { return ');
                attrs.unshift(getAnonymousFunctionName(node, cmd.value[0]));
                attrs.unshift('function ');
                attrs.unshift();
                attrs.push('; }');
            }
        }

        attrs = attrs.join('');

        if (!plain) {
            attrs = adjustJS(parseJS(attrs));
        }

        if (tag.plain) {
            tagFunc = tagFuncs.indexOf(tag.value) >= 0;
            tag = tagFunc ? '.' + tag.value + '(' : '.elem(' + JSON.stringify(tag.value);
        } else {
            tmp = [];
            tmp.push('function ');
            tmp.push(getAnonymousFunctionName(node, cmd.value[0]));
            tmp.push('() { return ');
            tmp.push(tag.value);
            tmp.push('; }');
            tag = adjustJS(parseJS(tmp.join('')));
            tag = '.elem(' + tag;
        }

        builder.write(tag, cmd.value[0]);
        if (attrs) {
            if (!tagFunc) { builder.write(', '); }
            builder.write(attrs);
        }
        builder.write(')');

        if (elemVar) {
            builder.writeln('');
            builder.write(INDENT);
            builder.write('.act(function() { ');
            if (elemVar) {
                builder.write(getExpressionString(node, elemVar, false), elemVar);
                builder.write(' = ');
            }
            builder.write('this; })');
        }

        builder.writeln('');
    };

    node.getCodeAfter = function getCodeAfter(builder) {
        builder.writeln(getEnds(node));
    };

    processSubcommands(node, cmd);

    return 1;
}


function processInclude(parent, cmd) {
    if (parent.root !== null) {
        // Only direct template ancestors are allowed as includes.
        throw new ConkittyErrors.InconsistentCommand(cmd.value[0]);
    }

    var error = conkittyMatch(
        cmd.value,
        [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.INCLUDE, null)]
    );
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    assertNoChildren(cmd);

    parent.addInclude(cmd.value[0]);

    return 1;
}


function processAppender(parent, cmd) {
    var error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.NODE_APPENDER, null)]),
        node;

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    node = new ConkittyGeneratorElement(parent);
    parent.appendChild(node);

    node.extraIndent = 1;

    node.getCodeBefore = function getCodeBefore(builder) {
        builder.writeln('.act(function() {', cmd.value[0]);
        builder.write(INDENT);
        builder.write('$C(');
        builder.write(getExpressionString(node, cmd.value[0].value, false), cmd.value[0].value);
        builder.writeln(', false, true)');
    };

    node.getCodeAfter = function getCodeAfter(builder) {
        builder.write(INDENT);
        builder.write(getEnds(node, true));
        builder.writeln(';');
        builder.writeln('})');
    };

    processSubcommands(node, cmd);

    return 1;
}


/* exported process */
function process(parent, index, commands) {
    var cmd = commands[index],
        ret;

    switch (cmd.value[0].type) {
        case ConkittyTypes.TEMPLATE_NAME:
            ret = processCall(parent, false, cmd);
            break;

        case ConkittyTypes.COMMAND_NAME:
            switch (cmd.value[0].value) {
                case 'ATTR':
                    ret = processAttr(parent, true, cmd);
                    break;

                case 'CALL':
                    ret = processCall(parent, true, cmd, commands[index + 1]);
                    break;

                case 'CHOOSE':
                    ret = processChoose(parent, cmd);
                    break;

                case 'EACH':
                    ret = processEach(parent, cmd, commands[index + 1]);
                    break;

                case 'EXPOSE':
                    ret = processExpose(parent, cmd);
                    break;

                case 'JS':
                    ret = processJS(parent, cmd);
                    break;

                case 'MEM':
                    ret = processMem(parent, cmd);
                    break;

                case 'PAYLOAD':
                    ret = processPayload(parent, cmd);
                    break;

                case 'SET':
                    ret = processSet(parent, cmd);
                    break;

                case 'TEST':
                    ret = processTest(parent, cmd);
                    break;

                case 'TRIGGER':
                    ret = processTrigger(parent, cmd);
                    break;

                case 'WITH':
                    ret = processWith(parent, cmd, commands[index + 1]);
                    break;

                default:
                    throw new ConkittyErrors.InconsistentCommand(cmd.value[0]);
            }

            break;

        case ConkittyTypes.VARIABLE:
            ret = processVariable(parent, cmd);
            break;

        case ConkittyTypes.JAVASCRIPT:
            ret = processJavascript(parent, cmd);
            break;

        case ConkittyTypes.STRING:
            ret = processString(parent, cmd);
            break;

        case ConkittyTypes.CSS:
            ret = processElement(parent, cmd);
            break;

        case ConkittyTypes.ATTR:
            ret = processAttr(parent, false, cmd);
            break;

        case ConkittyTypes.INCLUDE:
            ret = processInclude(parent, cmd);
            break;

        case ConkittyTypes.NODE_APPENDER:
            ret = processAppender(parent, cmd);
            break;

        default:
            throw new ConkittyErrors.InconsistentCommand(cmd.value[0]);
    }

    return index + ret;
}


function processTemplate(cmd, names, generator) {
    var error,
        pattern = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.TEMPLATE_NAME, null),
            new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_DECL, null)
        ],
        tpl,
        subCommands,
        i,
        arg;

    error = conkittyMatch(cmd.value, pattern);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    tpl = new ConkittyGeneratorTemplate(cmd.value, names, generator);

    subCommands = cmd.children;

    if (!tpl.name) {
        // When template name is empty, it is a namespace common includes
        // declarator. So, only `ConkittyTypes.INCLUDE` allowed here.
        for (i = 0; i < subCommands.length; i++) {
            if (subCommands[i].value[0].type !== ConkittyTypes.INCLUDE) {
                throw new ConkittyErrors.InconsistentCommand(subCommands[i].value[0]);
            }
        }

        if (cmd.value.length > 1) {
            // It is not an actual template, no arguments are possible.
            throw new ConkittyErrors.InconsistentCommand(cmd.value[1]);
        }
    } else {
        // Remember arguments.
        for (i = 1; i < cmd.value.length; i++) {
            arg = cmd.value[i];
            tpl.args[arg.name] = arg.value ? getExpressionString(tpl, arg.value, false) : '';
        }

        tpl.getCodeBefore = function getCodeBefore(builder) {
            builder.write('$C.', cmd.value[0]);
            if (tpl.namespace) {
                builder.write('_');
            }
            builder.write('tpl["');
            if (tpl.namespace) {
                builder.write(tpl.namespace);
                builder.write('::');
            }
            builder.write(tpl.name);
            builder.write('"] = function(');
            builder.write(Object.keys(tpl.args).join(', '));
            builder.write(') {');
            builder.writeln('');

            for (var arg in tpl.args) {
                if (tpl.args[arg]) {
                    builder.write(INDENT);
                    builder.write('(');
                    builder.write(arg);
                    builder.write(' === undefined) && (');
                    builder.write(arg);
                    builder.write(' = ');
                    builder.write(tpl.args[arg]);
                    builder.writeln(');');
                }
            }

            builder.write(INDENT);
            builder.write('var ');
            builder.write(tpl.getVarName('env'));
            builder.write(' = ');
            builder.write(tpl.getVarName('getEnv'));
            builder.write('(this)');

            if (tpl.hasRetMaker) {
                builder.write(', ');
                builder.write(tpl.getVarName('ret'));
            }

            arg = Object.keys(tpl.vars);
            if (arg.length) {
                builder.write(', ');
                builder.write(arg.join(', '));
            }

            builder.writeln(';');
            builder.write(INDENT);
            if (!tpl.hasRetMaker) { builder.write('return '); }
            builder.write('$C(');
            builder.write(tpl.getVarName('env'));
            builder.writeln('.p)');
        };

        tpl.getCodeAfter = function getCodeAfter(builder) {
            var end = getEnds(tpl);

            if (end) {
                builder.write(INDENT);
                builder.write(end);
                builder.writeln(';');
            }

            if (tpl.hasRetMaker) {
                builder.write(INDENT);
                builder.write('return ');
                builder.write(tpl.getVarName('ret'));
                builder.writeln(';');
            }

            builder.writeln('};\n', undefined, true);
        };
    }

    processSubcommands(tpl, cmd);

    return tpl;
}


function ConkittyGenerator(code) {
    var tpls = {},
        tpl,
        ns,
        names = {
            env: '$ConkittyEnv',
            EnvClass: '$ConkittyEnvClass',
            getEnv: '$ConkittyGetEnv',
            joinClasses: '$ConkittyClasses',
            getModClass: '$ConkittyMod',
            getChangedClass: '$ConkittyChange',
            ret: '$ConkittyTemplateRet'
        };

    for (var i = 0; i < code.length; i++) {
        tpl = processTemplate(code[i], names, this);

        if (!((ns = tpls[tpl.namespace]))) {
            ns = tpls[tpl.namespace] = {};
        }

        if (tpl.name in ns) {
            throw new ConkittyErrors.DuplicateDecl(code[i].value[0]);
        }

        ns[tpl.name] = tpl;
    }

    this.templates = tpls;
}


function generateCode(node, codeBuilder, level) {
    var indent = (new Array(level || 1)).join(INDENT),
        oldIndent = codeBuilder.getCurrentIndent();

    level = level === undefined ? 3 : level + 1;

    codeBuilder.setCurrentIndent(indent);

    node.getCodeBefore && node.getCodeBefore(codeBuilder);

    for (var i = 0; i < node.children.length; i++) {
        generateCode(node.children[i], codeBuilder, level + (node.extraIndent || 0));
    }

    node.getCodeAfter && node.getCodeAfter(codeBuilder);

    codeBuilder.setCurrentIndent(oldIndent);
}


function getTemplateIncludes(tpl, includes) {
    var incs,
        inc,
        i;

    incs = Object.keys(tpl.includes);
    for (i = 0; i < incs.length; i++) {
        inc = incs[i];
        if (!(inc in includes)) {
            includes[inc] = tpl.includes[inc];
        }
    }
}


function getCalledNSTemplates(tpls, template, ret, includes) {
    var calls = template.calls,
        callsns,
        retns,
        tpl,
        ns,
        name;

    for (ns in calls) {
        callsns = calls[ns];

        if (!((retns = ret[ns]))) {
            retns = ret[ns] = {};
            tpl = retns[''] = tpls[ns][''];
            if (tpl) {
                getTemplateIncludes(tpl, includes);
            }
        }

        for (name in callsns) {
            if (!(name in retns)) {
                tpl = retns[name] = tpls[ns][name];
                getCalledNSTemplates(tpls, tpl, ret, includes);
                getTemplateIncludes(tpl, includes);
            }
        }
    }

    getTemplateIncludes(template, includes);
}


ConkittyGenerator.prototype.generateCode = function(sourceMapFile) {
    var ret,
        codeBuilder = new ConkittyCodeBuilder(!!sourceMapFile),
        i,
        tpl,
        calls = {'': {}},
        includes = {},
        tpls,
        ns,
        name,
        common;

    for (i in this.templates['']) {
        tpl = this.templates[''][i];
        if (!(i in calls[''])) { calls[''][i] = tpl; }
        getCalledNSTemplates(this.templates, tpl, calls, includes);
    }

    codeBuilder.writeln('// This file is autogenerated.');
    if (sourceMapFile) {
        codeBuilder.write('//@ sourceMappingURL=');
        codeBuilder.writeln(sourceMapFile);
    }

    if (tpl) {
        codeBuilder.write('(function($C, ');
        codeBuilder.write(tpl.getVarName('EnvClass'));
        codeBuilder.write(', ');
        codeBuilder.write(tpl.getVarName('getEnv'));
        codeBuilder.write(', ');
        codeBuilder.write(tpl.getVarName('joinClasses'));
        codeBuilder.write(', ');
        codeBuilder.write(tpl.getVarName('getModClass'));
        codeBuilder.write(', ');
        codeBuilder.write(tpl.getVarName('getChangedClass'));
        codeBuilder.writeln(', window, Node, undefined) {\n', undefined, true);
    }

    for (ns in calls) {
        tpls = calls[ns];

        for (name in tpls) {
            if (name !== '') {
                generateCode(tpls[name], codeBuilder);
            }
        }
    }

    if (tpl) {
        common = [];
        common.push(fs.readFileSync(__dirname + '/node_modules/concat.js/concat.js', {encoding: 'utf8'}));
        common.push(fs.readFileSync(__dirname + '/_env.js', {encoding: 'utf8'}));

        codeBuilder.writeln('}).apply(null, $C._$args);');
        ret = codeBuilder.getCode();
    }

    return {
        includes: includes,
        common: common && common.join('\n'),
        code: ret,
        map: codeBuilder.getSourceMap()
    };
};


module.exports.ConkittyGenerator = ConkittyGenerator;
module.exports.ConkittyPatternPart = ConkittyPatternPart;
