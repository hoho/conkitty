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


function conkittyGetValuePatternPart(cmd, count) {
    return new ConkittyPatternPart(cmd.value, count,
        ConkittyTypes.VARIABLE, null,
        ConkittyTypes.JAVASCRIPT, null,
        ConkittyTypes.STRING, null,
        ConkittyTypes.COMMAND_NAME, 'PAYLOAD'
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


function ConkittyGeneratorTemplate(cmd, names) {
    ConkittyGeneratorTemplate.superclass.constructor.call(this, null, true);

    this.names = names;

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


ConkittyGeneratorValue.prototype.absorb = function absorb(val) {
    console.log(val);
};


ConkittyGeneratorAction.prototype.canAbsorb = function absorb(act) {
    return (act instanceof ConkittyGeneratorAction) &&
        !this.isFunc &&
        !act.isFunc;
};


ConkittyGeneratorAction.prototype.absorb = function absorb(act) {
    console.log(act);
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
            return JSON.stringify(evalString(val.value));

        default:
            throw new ConkittyErrors.InconsistentCommand(val);
    }

}


function getEnds(node) {
    if (node.ends) {
        if (node.next || !node.root || !(node instanceof ConkittyGeneratorElement)) {
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


function processAttr() {
    return 1;
}


function processCall(parent, startsWithCALL, cmd, except) {
    var pattern,
        error,
        offset;

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
        }

        parent.addCall(cmd.value[1].namespace, cmd.value[1].value);
    } else {
        pattern = [
            new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.TEMPLATE_NAME, null),
            conkittyGetValuePatternPart(cmd, '*'),
            new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_VAL, null)
        ];

        error = conkittyMatch(cmd.value, pattern);
        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

        offset = 1;

        parent.addCall(cmd.value[0].namespace, cmd.value[0].value);
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
                ret.push(' = C_; ');
            }
            if (key) {
                ret.push(key.value);
                ret.push(' = C__; ');
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


function processMem() {
    return 1;
}


function processPayload() {
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

    return 1;
}


function processTrigger() {
    return 1;
}


function processWith() {
    return 1;
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
        ret.push(getExpressionString(node, cmd.value[0], true));
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
            ret.push('.act(function ' + getAnonymousFunctionName(node, cmd.value[0]) + '($C__) {\n');
            ret.push(INDENT);
            ret.push('if ((');
            ret.push('$C__ = ' + getExpressionString(node, cmd.value[0], false));
            ret.push(') instanceof Node) { this.appendChild($C__); }\n');
            ret.push(INDENT);
            ret.push('else { $C(this).text($C__, true).end(); };\n');
            ret.push('})');
            return ret.join('');
        };
    } else {
        node.getCodeBefore = function getCodeBefore() {
            var ret = [];
            ret.push('.text(');
            ret.push(getExpressionString(node, cmd.value[0], true));
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
        ret.push(JSON.stringify(evalString(cmd.value[0].value)));
        if (cmd.value[0].raw) { ret.push(', true'); }
        ret.push(')');
        return ret.join('');
    };

    return 1;
}


function processElement(parent, cmd) {
    var node,
        error;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.CSS, null)]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    node = new ConkittyGeneratorElement(parent);
    parent.appendChild(node);

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

        default:
            throw new ConkittyErrors.InconsistentCommand(cmd.value[0]);
    }

    return index + ret;
}


function processTemplate(cmd, names) {
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

    tpl = new ConkittyGeneratorTemplate(cmd.value, names);

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
            ret.push(INDENT);
            ret.push('var ');
            ret.push(tpl.getVarName('env'));
            ret.push(' = ');
            ret.push(tpl.getVarName('getEnv'));
            ret.push('(this)');

            arg = Object.keys(tpl.vars);
            if (arg.length) {
                ret.push(', ');
                ret.push(arg.join(', '));
            }

            ret.push(';\n');
            ret.push(INDENT);
            ret.push('$C(');
            ret.push(tpl.getVarName('env'));
            ret.push('.parent)');

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
            ret.push('};');

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
        rnd = Math.round(Math.random() * 9999),
        names = {
            env: '$ConkittyEnv' + rnd,
            envClass: '$ConkittyEnvClass' + rnd,
            getEnv: '$ConkittyGetEnv' + rnd,
            joinClasses: '$ConkittyClasses' + rnd,
            getModClass: '$ConkittyMod' + rnd
        };

    for (var i = 0; i < code.length; i++) {
        tpl = processTemplate(code[i], names);

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
            .replace(/envClass/g, tpl.getVarName('envClass'))
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
