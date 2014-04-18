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


function getAnonymousFunctionName(name, part) {
    return '$C_' + name.replace(/\-/g, '_') + '_' + (part.lineAt + 1) + '_' + (part.charAt + 1);
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


function getExpressionString(val) {
    switch (val.type) {
        case ConkittyTypes.JAVASCRIPT:
            return '(' + val.value + ')';

        case ConkittyTypes.STRING:
            return val.value;

        case ConkittyTypes.VARIABLE:
            return val.value;

        default:
            throw new ConkittyErrors.InconsistentCommand(val);
    }

}


function getEnds(node) {
    if (node.ends) {
        if (node.next || !node.root) {
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


function getAttrsByCSS(css) {
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
                                curRet[i] = {plain: false, value: getExpressionString(cur.value)};
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
                                    exprs.push('$ConkittyMod("' + cur.name + '", ' + getExpressionString(cur.value) + ')');
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
                    exprs.unshift('"' + classes + '"');
                }

                curRet['class'] = {plain: false, value: '$ConkittyClasses(' + exprs.join(', ') + ')'};
            } else if (classes) {
                curRet['class'] = {plain: true, value: classes};
            }
        }
    }

    for (i = 0; i < css.ifs.length; i++) {
        positive = getAttrsByCSS(css.ifs[i].positive);
        negative = getAttrsByCSS(css.ifs[i].negative);

        for (j in curRet) {

            if ((j in positive) || (j in negative)) {
                cur = [];
                cur.push('(');
                cur.push(getExpressionString(css.ifs[i].cond));
                cur.push(' ? ');
                if (j in positive) {
                    if (positive[j].plain) { cur.push('"'); }
                    cur.push(positive[j].value);
                    if (positive[j].plain) { cur.push('"'); }
                } else {
                    cur.push('undefined');
                }
                cur.push(' : ');
                if (j in negative) {
                    if (negative[j].plain) { cur.push('"'); }
                    cur.push(negative[j].value);
                    if (negative[j].plain) { cur.push('"'); }
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
                    return val.plain ? '"' + val.value + '"' : val.value;
                });

                if (j === 'class') {
                    ret[j] = {plain: false, value: '$ConkittyClasses(' + cur.join(', ') + ')'};
                } else {
                    ret[j] = {plain: false, value: cur.join(' || ')};
                }
            }
        }
    }

    return ret;
}


function ConkittyGeneratorNode(parent, hasEnd) {
    this.parent = parent;
    this.root = parent && parent.root ? parent.root : parent;
    this.children = [];
    this.next = this.prev = null;
    this.ends = hasEnd ? 1 : 0;
}


ConkittyGeneratorNode.prototype.addVariable = function addVariable(name) {
    (this.root || this).vars[name] = true;
};


ConkittyGeneratorNode.prototype.addCall = function addCall(namespace, name) {
    var cur,
        root = this.root || this;
    if (!((cur = root.calls[namespace]))) {
        cur = root.calls[namespace] = {};
    }
    cur[name] = true;
};


ConkittyGeneratorNode.prototype.addInclude = function addVariable(filename) {
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


function ConkittyGeneratorTemplate(cmd) {
    ConkittyGeneratorTemplate.superclass.constructor.call(this, null, true);

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
            new ConkittyPatternPart(cmd.value, '*',
                ConkittyTypes.VARIABLE, null,
                ConkittyTypes.JAVASCRIPT, null,
                ConkittyTypes.STRING, null,
                ConkittyTypes.COMMAND_NAME, 'PAYLOAD'
            ),
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
            new ConkittyPatternPart(cmd.value, '*',
                ConkittyTypes.VARIABLE, null,
                ConkittyTypes.JAVASCRIPT, null,
                ConkittyTypes.STRING, null,
                ConkittyTypes.COMMAND_NAME, 'PAYLOAD'
            ),
            new ConkittyPatternPart(cmd.value, '*', ConkittyTypes.ARGUMENT_VAL, null)
        ];

        error = conkittyMatch(cmd.value, pattern);
        if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

        offset = 1;

        parent.addCall(cmd.value[0].namespace, cmd.value[0].value);
    }

    return offset;
}


function processChoose() {
    return 1;
}


function processEach() {
    return 1;
}


function processMem() {
    return 1;
}


function processPayload() {
    return 1;
}


function processSet() {
    return 1;
}


function processTest() {
    return 1;
}


function processTrigger() {
    return 1;
}


function processWith() {
    return 1;
}


function processVariable() {
    return 1;
}


function processJavascript() {
    return 1;
}


function processString() {
    return 1;
}


function processElement(parent, cmd) {
    var node,
        error,
        tag,
        tmp,
        i,
        plain,
        attrs,
        tagFunc;

    error = conkittyMatch(cmd.value, [new ConkittyPatternPart(cmd.value, 1, ConkittyTypes.CSS, null)]);
    if (error) { throw new ConkittyErrors.InconsistentCommand(error); }

    node = new ConkittyGeneratorElement(parent);
    parent.appendChild(node);

    tmp = getAttrsByCSS(cmd.value[0]);
    tag = tmp[''];
    delete tmp[''];
    if (!tag) { tag = {plain: true, value: 'div'}; }

    plain = true;
    attrs = [];
    for (i in tmp) {
        if (attrs.length) { attrs.push(', '); }
        attrs.push('"');
        attrs.push(i);
        attrs.push('": ');
        if (tmp[i].plain) { attrs.push('"'); }
        else { plain = false; }
        attrs.push(tmp[i].value);
        if (tmp[i].plain) { attrs.push('"'); }
    }

    if (attrs.length) {
        attrs.unshift('{');
        attrs.push('}');

        if (!plain) {
            attrs.unshift('() { return ');
            attrs.unshift(getAnonymousFunctionName(node.root.name, cmd.value[0]));
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
        tag = tagFunc ? '.' + tag.value + '(' : '.elem("' + tag.value + '"';
    } else {
        tmp = [];
        tmp.push('function ');
        tmp.push(getAnonymousFunctionName(node.root.name, cmd.value[0]));
        tmp.push('() { return ');
        tmp.push(tag.value);
        tmp.push('; }');
        tag = adjustJS(parseJS(tmp.join('')));
        tag = '.elem(' + tag;
    }

    node.getCodeBefore = function getCodeBefore() {
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


function processTemplate(cmd) {
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

    tpl = new ConkittyGeneratorTemplate(cmd.value);

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
            tpl.args[arg.name] = arg.value ? getExpressionString(arg.value) : '';
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
            ret.push('var $C_ = $C._u(this)');

            arg = Object.keys(tpl.vars);
            if (arg.length) {
                ret.push(', ');
                ret.push(arg.join(', '));
            }

            ret.push(';\n');
            ret.push(INDENT);
            ret.push('$C($C_.parent)');

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
        ns;

    for (var i = 0; i < code.length; i++) {
        tpl = processTemplate(code[i]);

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
        generateCode(node.children[i], ret, level);
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

    return ret.join('\n');
};


module.exports.ConkittyGenerator = ConkittyGenerator;
module.exports.ConkittyPatternPart = ConkittyPatternPart;
