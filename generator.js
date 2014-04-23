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


ConkittyGeneratorNode.prototype.addInclude = function addInclude(filename) {
    (this.root || this).includes.push(filename);
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
    this.includes = [];
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


function evalString(val) {
    /* jshint -W040 */
    return eval(val);
    /* jshint +W040 */
}


function getExpressionString(node, val, wrap, retMaker) {
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
                    if (retMaker) {
                        ret.push('function() { return ');
                        ret.push(retMaker);
                        ret.push(' = (');
                    }

                    if (!isVar) { ret.push('('); }
                    ret.push(val.value);
                    if (!isVar) { ret.push(')'); }

                    if (retMaker) {
                        ret.push(').apply(this, arguments); }');
                    }
                } else {
                    ret.push('function ');
                    ret.push(getAnonymousFunctionName(node, val));
                    ret.push('() { return ');

                    if (retMaker) {
                        ret.push(retMaker);
                        ret.push(' = (');
                    }

                    if (!isVar) { ret.push('('); }
                    ret.push(val.value);
                    if (!isVar) { ret.push(')'); }

                    if (retMaker) {
                        ret.push(')');
                    }

                    ret.push('; }');
                }
            } else {
                if (retMaker) {
                    ret.push('(');
                    ret.push(retMaker);
                    ret.push(' = ');
                }

                if (!isVar) { ret.push('('); }
                ret.push(val.value);
                if (!isVar) { ret.push(')'); }
                if (val.isFunc) { ret.push('.apply(this, arguments)'); }

                if (retMaker) {
                    ret.push(')');
                }
            }

            return ret.join('');

        case ConkittyTypes.STRING:
            ret = [];
            if (retMaker) {
                ret.push('(');
                ret.push(retMaker);
                ret.push(' = ');
            }

            ret.push(JSON.stringify(evalString(val.value)));

            if (retMaker) {
                ret.push(')');
            }

            return ret.join('');

        /* jshint -W086 */
        case ConkittyTypes.COMMAND_NAME:
            if (val.value === 'PAYLOAD') {
                ret = [];
                ret.push('function() { return ');
                ret.push(node.getVarName('env'));
                ret.push('.l(); }');
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
                                curRet[i] = {plain: true, value: evalString(cur.value.value)};
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
                                    classes.push(cur.name + '_' + evalString(cur.value.value));
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.attr(');
        if (isCommand) {
            ret.push(getExpressionString(node, cmd.value[1], true));
        } else {
            ret.push(JSON.stringify(cmd.value[0].name));
        }
        ret.push(', ');
        if (isCommand) {
            ret.push(getExpressionString(node, cmd.value[2], true));
        } else {
            var val = cmd.value[0].value;
            if (val.type === ConkittyTypes.CSS) {
                // Is is `class` attribute modification.
                val = getAttrsByCSS(node, val)['class'];
                switch (cmd.value[0].mode) {
                    case 'replace':
                        break;

                    default:
                        throw new Error('Mode is not implemented');
                }
                if (val.plain) {
                    ret.push(JSON.stringify(val.value));
                } else {
                    val.type = ConkittyTypes.JAVASCRIPT;
                    val.lineAt = cmd.value[0].lineAt;
                    val.charAt = cmd.value[0].charAt;
                    ret.push(getExpressionString(node, val, true));
                }
            } else {
                ret.push(getExpressionString(node, val, true));
            }
        }
        ret.push(')');
        return ret.join('');
    };

    return 1;
}


function getCallArguments(part, node, args) {
    var ret = [],
        i,
        j,
        argNames = part ? Object.keys(node.getTemplateArgDecls(part)) : [],
        kwArgs = [];

    for (i = 0; i < args.length; i++) {
        if (args[i].type === ConkittyTypes.ARGUMENT_VAL) { break; }
        argNames.shift();
        ret.push(', ');
        ret.push(getExpressionString(node, args[i], false));
    }

    for (i; i < args.length; i++) {
        if (args[i].type !== ConkittyTypes.ARGUMENT_VAL ||
            ((j = argNames.indexOf(args[i].name))) < 0)
        {
            throw new ConkittyErrors.InconsistentCommand(args[i]);
        }

        kwArgs[j] = args[i].value;
        argNames[j] = null;
    }

    for (i = 0; i < kwArgs.length; i++) {
        ret.push(', ');
        if (kwArgs[i] === undefined) {
            ret.push('undefined');
        } else {
            ret.push(getExpressionString(node, kwArgs[i], false));
        }
    }

    return ret.join('');
}


function processCall(parent, startsWithCALL, cmd, except) {
    var pattern,
        error,
        offset,
        name,
        node,
        callNode,
        tryNode,
        catchNode,
        payloadNode,
        exceptNode,
        args;

    if (startsWithCALL) {
        pattern = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.COMMAND_NAME, 'CALL'),
            new ConkittyPatternPart(cmd.value, 1,
                ConkittyTypes.TEMPLATE_NAME, null,
                ConkittyTypes.JAVASCRIPT, null,
                ConkittyTypes.VARIABLE, null
            ),
            conkittyGetValuePatternPart(cmd, '*'),
            new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_VAL, null)
        ];

        error = conkittyMatch(cmd.value, pattern);
        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

        offset = 1;
        if (except &&
            except.value[0].type === ConkittyTypes.COMMAND_NAME &&
            except.value[0].value === 'EXCEPT')
        {
            pattern = [new ConkittyPatternPart(except.value, 1, ConkittyTypes.COMMAND_NAME, 'EXCEPT')];

            error = conkittyMatch(except.value, pattern);
            if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

            offset++;
        } else {
            except = null;
        }

        name = cmd.value[1];
    } else {
        pattern = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.TEMPLATE_NAME, null),
            conkittyGetValuePatternPart(cmd, '*'),
            new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_VAL, null)
        ];

        error = conkittyMatch(cmd.value, pattern);
        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

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


    node.getCodeBefore = function getCodeBefore() {
        return '.act(function() {';
    };

    node.getCodeAfter = function getCodeAfter() {
        return '})';
    };

    callNode.getCodeBefore = function getCodeBefore() {
        var ret = [];

        if (cmd.value[0].retMaker) {
            ret.push(cmd.value[0].retMaker);
            ret.push(' = ');
        }

        ret.push('$C.tpl[');

        if (name.type === ConkittyTypes.TEMPLATE_NAME) {
            ret.push(JSON.stringify(name.value));
        } else {
            ret.push(getExpressionString(node, name, false));
        }

        args = getCallArguments(
            name.type === ConkittyTypes.TEMPLATE_NAME ? name : null,
            callNode,
            cmd.value.slice(startsWithCALL ? 2 : 1)
        );

        ret.push('].call(new ');
        ret.push(node.getVarName('EnvClass'));
        ret.push('(');
        if (payloadNode) {
            ret.push('\n');
            ret.push(INDENT);
        }
        ret.push('this');
        if (payloadNode) {
            ret.push(',');
        } else {
            ret.push(')');
            if (args) { ret.push(args); }
            ret.push(');');
        }
        return ret.join('');
    };

    if (payloadNode) {
        callNode.getCodeAfter = function getCodeAfter() {
            var ret = [];
            ret.push(')');
            if (args) { ret.push(args); }
            ret.push(');');
            return ret.join('');
        };

        payloadNode.extraIndent = 1;

        payloadNode.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('function() {\n');
            ret.push(INDENT);
            ret.push('return $C()');
            return ret.join('');
        };

        payloadNode.getCodeAfter = function getCodeAfter() {
            var ret = [];
            ret.push(INDENT);
            ret.push(getEnds(payloadNode, true));
            ret.push(';\n}');
            return ret.join('');
        };

        processSubcommands(payloadNode, cmd);
    }

    if (tryNode) {
        tryNode.getCodeBefore = function getCodeBefore() {
            return 'try {';
        };

        tryNode.getCodeAfter = function getCodeAfter() {
            return '} catch($C_e) {';
        };

        catchNode.getCodeAfter = function getCodeAfter() {
            return '}';
        };
    }

    if (exceptNode) {
        exceptNode.getCodeBefore = function getCodeBefore() {
            return '$C(this)';
        };

        exceptNode.getCodeAfter = function getCodeAfter() {
            var ret = [];
            ret.push(getEnds(exceptNode, true));
            ret.push(';');
            return ret.join('');
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
        choose.getCodeBefore = function getCodeBefore() { return '.choose()'; };
        choose.getCodeAfter = function getCodeAfter() { return getEnds(choose); };

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
                    node.getCodeBefore = function getCodeBefore() { return '.otherwise()'; };
                    node.getCodeAfter = function getCodeAfter() { return getEnds(node); };
                } else {
                    // It is WHEN.
                    node.getCodeBefore = function getCodeBefore() {
                        var ret = [];
                        ret.push('.when(');
                        ret.push(getExpressionString(node, subcmd.value[1], true));
                        ret.push(')');
                        return ret.join('');
                    };

                    node.getCodeAfter = function getCodeAfter() {
                        return getEnds(node);
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.each(');
        ret.push(getExpressionString(node, arr, true));
        ret.push(')');
        if (key || val) {
            ret.push('\n');
            ret.push(INDENT);
            ret.push('.act(function($C_');
            if (key) { ret.push(', $C__'); }
            ret.push(') { ');
            if (val) {
                ret.push(val.value);
                ret.push(' = $C_; ');
            }
            if (key) {
                ret.push(key.value);
                ret.push(' = $C__; ');
            }
            ret.push('})');
        }
        return ret.join('');
    };

    node.getCodeAfter = function getCodeAfter() {
        return getEnds(node);
    };

    processSubcommands(node, cmd);

    return 1;
}


function processJS(parent, cmd) {
    var node;

    node = new ConkittyGeneratorCommand(parent, false);
    parent.appendChild(node);

    node.getCodeBefore = function getCodeBefore() {
        var ret = [],
            args = cmd.value[0].args,
            i;

        ret.push('.act(function(');
        for (i = 0; i < args.length; i++) {
            if (i > 0) { ret.push(', '); }
            ret.push(args[i].value);
        }

        ret.push(') {');

        if (cmd.value[0].retMaker) {
            ret.push(' ');
            ret.push(cmd.value[0].retMaker);
            ret.push(' = (function() {');
        }

        ret.push('\n');

        ret.push(cmd.value[0].js.value);

        ret.push('\n');

        if (cmd.value[0].retMaker) {
            ret.push('}).call(this); ');
        }

        ret.push('})');
        return ret.join('');
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.mem(');
        ret.push(getExpressionString(node, cmd.value[1], true));
        if (expr) {
            ret.push(', ');
            ret.push(getExpressionString(node, expr, true));
        }
        ret.push(')');
        return ret.join('');
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.act(function() { ');
        ret.push(node.getVarName('env'));
        ret.push('.l(this); })');
        return ret.join('');
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
        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.act(function ');
            ret.push(getAnonymousFunctionName(node, cmd.value[0]));
            ret.push('() { ');
            ret.push(name);
            ret.push(' = ');
            ret.push(getExpressionString(node, cmd.value[2], false));
            ret.push('; })');
            return ret.join('');
        };
    } else if (cmd.children.length) {
        node.extraIndent = 1;
        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.act(function ');
            ret.push(getAnonymousFunctionName(node, cmd.value[0]));
            ret.push('() {\n');
            ret.push(INDENT);
            ret.push(name);
            ret.push(' = $C()');
            return ret.join('');
        };

        node.getCodeAfter = function getCodeAfter() {
            var ret = [];
            ret.push(INDENT);
            ret.push(getEnds(node));
            ret.push(';\n');
            ret.push(INDENT);
            ret.push(name);
            ret.push(' = ');
            ret.push(name);
            ret.push('.firstChild ? ');
            ret.push(name);
            ret.push(' : undefined;\n');
            ret.push('})');
            return ret.join('');
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

        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.test(');
            ret.push(getExpressionString(node, cmd.value[1], true));
            ret.push(')');
            return ret.join('');
        };

        node.getCodeAfter = function getCodeAfter() {
            return getEnds(node);
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [],
            i;
        ret.push('.trigger(');
        for (i = 1; i < cmd.value.length; i++) {
            if (i > 1) { ret.push(', '); }
            ret.push(getExpressionString(node, cmd.value[i], true));
        }
        ret.push(')');
        return ret.join('');
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.act(function() { try { ');
        ret.push(name);
        ret.push(' = ');
        ret.push(getExpressionString(node, cmd.value[2], false));
        ret.push('; } catch($C_e) { ');
        ret.push(name);
        ret.push(' = undefined; }})');
        return ret.join('');
    };

    hasElse = otherwise && otherwise.children.length;

    if (cmd.children.length || hasElse) {
        okNode = new ConkittyGeneratorCommand(parent, false);
        okNode.extraIndent = 1;
        okNode.ends = hasElse ? 1 : 2;

        parent.appendChild(okNode);

        okNode.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.choose()\n');
            ret.push(INDENT);
            ret.push('.when(function() { return ');
            ret.push(name);
            ret.push(' !== undefined && ');
            ret.push(name);
            ret.push(' !== null; })');
            return ret.join('');
        };

        okNode.getCodeAfter = function getCodeAfter() {
            var ret = [];
            if (hasElse) { ret.push(INDENT); }
            ret.push(getEnds(okNode));
            return ret.join('');
        };

        processSubcommands(okNode, cmd);
    }

    if (hasElse) {
        elseNode = new ConkittyGeneratorCommand(parent);
        elseNode.ends = 2;
        elseNode.extraIndent = 1;

        parent.appendChild(elseNode);

        elseNode.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push(INDENT);
            ret.push('.otherwise()');
            return ret.join('');
        };

        elseNode.getCodeAfter = function getCodeAfter() { return getEnds(elseNode); };

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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.text(');
        ret.push(getExpressionString(node, cmd.value[0], true, cmd.value[0].retMaker));
        ret.push(')');
        return ret.join('');
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
        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.act(function ' + getAnonymousFunctionName(node, cmd.value[0]) + '($C_) {\n');
            ret.push(INDENT);
            ret.push('if ((');
            ret.push('$C_ = ' + getExpressionString(node, cmd.value[0], false, cmd.value[0].retMaker));
            ret.push(') instanceof Node) { this.appendChild($C_); }\n');
            ret.push(INDENT);
            ret.push('else { $C(this).text($C_, true).end(); };\n');
            ret.push('})');
            return ret.join('');
        };
    } else {
        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.text(');
            ret.push(getExpressionString(node, cmd.value[0], true, cmd.value[0].retMaker));
            ret.push(')');
            return ret.join('');
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

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.text(');
        ret.push(getExpressionString(node, cmd.value[0], false, cmd.value[0].retMaker));
        if (cmd.value[0].raw) { ret.push(', true'); }
        ret.push(')');
        return ret.join('');
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

    node.getCodeBefore = function getCodeBefore() {
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

        var ret = [];
        ret.push(tag);
        if (attrs) {
            if (!tagFunc) { ret.push(', '); }
            ret.push(attrs);
        }
        ret.push(')');

        if (elemVar || cmd.value[0].retMaker) {
            ret.push('\n');
            ret.push(INDENT);
            ret.push('.act(function() { ');
            if (cmd.value[0].retMaker) {
                ret.push(node.getVarName('ret'));
                ret.push(' = ');
            }
            if (elemVar) {
                ret.push(getExpressionString(node, elemVar, false));
                ret.push(' = ');
            }
            ret.push('this; })');
        }

        return ret.join('');
    };

    node.getCodeAfter = function getCodeAfter() {
        return getEnds(node);
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

    parent.addInclude(evalString(cmd.value[0].value));

    return 1;
}


function processAppender(parent, cmd) {
    var error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.NODE_APPENDER, null)]),
        node;

    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    node = new ConkittyGeneratorElement(parent);
    parent.appendChild(node);

    node.extraIndent = 1;

    node.getCodeBefore = function getCodeBefore() {
        var ret = [];
        ret.push('.act(function() {\n');
        ret.push(INDENT);
        ret.push('$C(');
        ret.push(getExpressionString(node, cmd.value[0].value, false));
        ret.push(', false, true)');
        return ret.join('');
    };

    node.getCodeAfter = function getCodeAfter() {
        var ret = [];
        ret.push(INDENT);
        ret.push(getEnds(node, true));
        ret.push(';\n})');
        return ret.join('');
    };

    processSubcommands(node, cmd);

    return 1;
}


/* exported process */
function process(parent, index, commands) {
    var cmd = commands[index],
        ret,
        retMaker,
        retMakerVar;

    if (cmd.value[0].type === ConkittyTypes.RET_MAKER && cmd.value.length > 1) {
        retMaker = cmd.value.shift();
        if (parent.root) {
            throw new ConkittyErrors.InconsistentCommand(retMaker);
        }

        if (parent.hasRetMaker) {
            throw new ConkittyErrors.DuplicateDecl(retMaker);
        }

        retMakerVar = parent.getVarName('ret');
        parent.hasRetMaker = true;
    }

    switch (cmd.value[0].type) {
        case ConkittyTypes.TEMPLATE_NAME:
            cmd.value[0].retMaker = retMakerVar;
            retMakerVar = null;
            ret = processCall(parent, false, cmd);
            break;

        case ConkittyTypes.COMMAND_NAME:
            switch (cmd.value[0].value) {
                case 'ATTR':
                    ret = processAttr(parent, true, cmd);
                    break;

                case 'CALL':
                    cmd.value[0].retMaker = retMakerVar;
                    retMakerVar = null;
                    ret = processCall(parent, true, cmd, commands[index + 1]);
                    break;

                case 'CHOOSE':
                    ret = processChoose(parent, cmd);
                    break;

                case 'EACH':
                    ret = processEach(parent, cmd, commands[index + 1]);
                    break;

                case 'JS':
                    cmd.value[0].retMaker = retMakerVar;
                    retMakerVar = null;
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
            cmd.value[0].retMaker = retMakerVar;
            retMakerVar = null;
            ret = processVariable(parent, cmd);
            break;

        case ConkittyTypes.JAVASCRIPT:
            cmd.value[0].retMaker = retMakerVar;
            retMakerVar = null;
            ret = processJavascript(parent, cmd);
            break;

        case ConkittyTypes.STRING:
            cmd.value[0].retMaker = retMakerVar;
            retMakerVar = null;
            ret = processString(parent, cmd);
            break;

        case ConkittyTypes.CSS:
            cmd.value[0].retMaker = retMakerVar;
            retMakerVar = null;
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

    if (retMakerVar) {
        throw new ConkittyErrors.InconsistentCommand(retMaker);
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

        tpl.getCodeBefore = function getCodeBefore() {
            var ret = [];

            ret.push('$C.');
            if (tpl.namespace) { ret.push('_'); }
            ret.push('tpl["');
            if (tpl.namespace) {
                ret.push(tpl.namespace);
                ret.push('::');
            }
            ret.push(tpl.name);
            ret.push('"] = function(');
            ret.push(Object.keys(tpl.args).join(', '));
            ret.push(') {');
            ret.push('\n');

            for (var arg in tpl.args) {
                if (tpl.args[arg]) {
                    ret.push(INDENT);
                    ret.push('(');
                    ret.push(arg);
                    ret.push(' === undefined) && (');
                    ret.push(arg);
                    ret.push(' = ');
                    ret.push(tpl.args[arg]);
                    ret.push(');\n');
                }
            }

            ret.push(INDENT);
            ret.push('var ');
            ret.push(tpl.getVarName('env'));
            ret.push(' = ');
            ret.push(tpl.getVarName('getEnv'));
            ret.push('(this)');

            if (tpl.hasRetMaker) {
                ret.push(', ');
                ret.push(tpl.getVarName('ret'));
            }

            arg = Object.keys(tpl.vars);
            if (arg.length) {
                ret.push(', ');
                ret.push(arg.join(', '));
            }

            ret.push(';\n');
            ret.push(INDENT);
            ret.push('$C(');
            ret.push(tpl.getVarName('env'));
            ret.push('.p)');

            return ret.join('');
        };

        tpl.getCodeAfter = function getCodeAfter() {
            var ret = [],
                end = getEnds(tpl);

            if (end) {
                ret.push(INDENT);
                ret.push(end);
                ret.push(';\n');
            }

            if (tpl.hasRetMaker) {
                ret.push(INDENT);
                ret.push('return ');
                ret.push(tpl.getVarName('ret'));
                ret.push(';\n');
            }

            ret.push('};\n');

            return ret.join('');
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


function generateCode(node, ret, level) {
    var indent = (new Array(level || 1)).join(INDENT),
        line;

    level = level === undefined ? 3 : level + 1;

    if (node.getCodeBefore && ((line = node.getCodeBefore()))) {
        ret.push(indent + line.split('\n').join('\n' + indent));
    }

    for (var i = 0; i < node.children.length; i++) {
        generateCode(node.children[i], ret, level + (node.extraIndent || 0));
    }

    if (node.getCodeAfter && ((line = node.getCodeAfter()))) {
        ret.push(indent + line.split('\n').join('\n' + indent));
    }
}


ConkittyGenerator.prototype.generateCode = function() {
    var ret = [],
        i,
        tpl;

    for (i in this.templates['']) {
        tpl = this.templates[''][i];
        generateCode(tpl, ret);
    }

    if (tpl) {
        var env = fs.readFileSync(__dirname + '/_env.js', {encoding: 'utf8'});
        env = env
            .replace(/EnvClass/g, tpl.getVarName('EnvClass'))
            .replace(/getEnv/g, tpl.getVarName('getEnv'))
            .replace(/joinClasses/g, tpl.getVarName('joinClasses'))
            .replace(/getModClass/g, tpl.getVarName('getModClass'));
        ret.unshift(env);
    }

    ret.unshift('(function($C, undefined) {\n');

    ret.push('\n})($C);');

    return ret.join('\n');
};


module.exports.ConkittyGenerator = ConkittyGenerator;
module.exports.ConkittyPatternPart = ConkittyPatternPart;
