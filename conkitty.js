/*!
 * conkitty v0.4.7, https://github.com/hoho/conkitty
 * Copyright 2013 Marat Abdullin
 * Released under the MIT license
 */
var conkittyCompile;

(function() {
    'use strict';

    var whitespace = /[\x20\t\r\n\f]/,
        attrName = /^[a-zA-Z][a-zA-Z0-9-_]*$/g,
        _tags = 'div|span|p|a|ul|ol|li|table|tr|td|th|br|img|b|i|s|u'.split('|'),
        TAG_FUNCS = {},
        i,
        indentWith = '    ',
        source,
        code,
        variables,
        currentTemplateName;

    for (i = 0; i < _tags.length; i++) {
        TAG_FUNCS[_tags[i]] = true;
    }


    function strip(str) {
        return str.replace(/^\s+|\s+$/g, '');
    }

    function addIndent(ret, size) {
        ret.push((new Array(size)).join(indentWith));
    }

    function skipWhitespaces(str, col) {
        while (col < str.length && whitespace.test(str[col])) {
            col++;
        }

        return col;
    }

    function startsWith(str, pos, what) {
        var i = pos + what.length;
        return str.substring(pos, i) === what && (str.length === i || whitespace.test(str[i]));
    }

    function conkittyGetAnonymousFunctionName(line, col) {
        return '$C_' + currentTemplateName.replace(/\-/g, '_') + '_' + (line + 1) + '_' + (col + 1);
    }


    function conkittyError(line, col, message) {
        throw new Error(message + ' (line: ' + (line + 1) + ', col: ' + (col + 1) + '):\n' +
                        source[line] + '\n' + (new Array(col + 1).join(' ')) + '^');
    }

    function conkittyErrorUnexpectedSymbol(line, col, chr) {
        conkittyError(line, col, "Unexpected symbol '" + chr + "'");
    }

    function conkittyCheckName(line, col, name, isCall) {
        var nameExpr = isCall ? /^[a-zA-Z_][a-zA-Z0-9_-]*$/ : /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (name === '_' || name === '__' || name === '___' || name === '$C_e' || !name.match(nameExpr)) {
            conkittyError(line, col, "Illegal name '" + name + "'");
        }
    }


    function conkittyTokenizeSelector(line, selector) {
        selector = selector.replace(/\s+$/g, '');

        var selectorLength = selector.length,
            className = [],
            attr = {},
            mods = {},
            elem,
            val = [],
            bemElem = [],
            what,
            i,
            whatCol,

            bemName = /^[a-zA-Z0-9-]+$/g,
            blockPrefixes = /^(?:b-|l-)[a-zA-Z0-9-]/,
            modSeparator = '_',
            elemSeparator = '__',

            processToken = function() {
                if (!val.length) {
                    if (what === undefined) {
                        return;
                    }

                    conkittyError(line, whatCol, 'No name');
                }

                val = val.join('');

                switch (what) {
                    case '.':
                        if (!val.match(attrName)) {
                            conkittyError(line, whatCol, "Illegal class name '" + val + "'");
                        }

                        if ('class' in attr) {
                            conkittyError(line, whatCol, "Previously assigned 'class' attribute is being rewritten");
                        }

                        className.push(val);
                        break;

                    case '#':
                        if ('id' in attr) {
                            conkittyError(line, whatCol, "'id' attribute is already set");
                        }

                        attr.id = val;
                        break;

                    case '%':
                        if (!val.match(bemName) || !val.match(blockPrefixes)) {
                            conkittyError(line, whatCol, "Illegal block name '" + val + "'");
                        }

                        if (bemElem.length) {
                            if (!bemElem.match(bemName)) {
                                conkittyError(line, whatCol, "Illegal element name '" + bemElem + "'");
                            }

                            val += elemSeparator + bemElem;
                            bemElem = [];
                        }

                        if ('class' in attr) {
                            conkittyError(line, whatCol, "Previously assigned 'class' attribute is being rewritten");
                        }

                        className.push(val);

                        for (var name in mods) {
                            className.push(val + modSeparator + name + (mods[name] === true ? '' : modSeparator + mods[name]));
                        }

                        break;

                    case undefined:
                        if (elem) {
                            conkittyError(line, whatCol, "Duplicate tag name ('" + val + "')");
                        }
                        elem = val;
                        break;
                }

            },

            processAttrMod = function(closer) {
                var name = [],
                    value = [],
                    isString,
                    attrmodCol = i;

                if (closer === '}' && what !== '%') {
                    conkittyError(line, i, 'Modifier has no block');
                }

                i++;

                i = skipWhitespaces(selector, i);

                while (i < selectorLength && !whitespace.test(selector[i]) && selector[i] !== '=' && selector[i] !== closer) {
                    name.push(selector[i]);
                    i++;
                }

                i = skipWhitespaces(selector, i);

                if (selector[i] === '=') {
                    i++;
                }

                i = skipWhitespaces(selector, i);

                if (selector[i] !== closer) {
                    if (selector[i] === '"') {
                        isString = true;
                        i++;
                    }

                    while (i < selectorLength) {
                        if (selector[i] === '"') {
                            if (isString) {
                                i++;
                                break;
                            } else {
                                conkittyError(line, i, "Illegal symbol '" + selector[i] + "'");
                            }
                        } else if (selector[i] === '\\') {
                            if (isString) {
                                i++;

                                if (selector[i] === '\\') {
                                    value.push('\\');
                                } else if (selector[i] === '"') {
                                    value.push('"');
                                } else {
                                    conkittyError(line, i, "Illegal symbol '" + selector[i] + "'");
                                }

                                i++;
                            } else {
                                conkittyError(line, i, "Illegal symbol '" + selector[i] + "'");
                            }
                        } else {
                            if (isString) {
                                value.push(selector[i]);
                            } else {
                                if (selector[i] === closer || whitespace.test(selector[i])) {
                                    break;
                                } else {
                                    value.push(selector[i]);
                                }
                            }

                            i++;
                        }
                    }

                    i = skipWhitespaces(selector, i);
                }

                if (selector[i] !== closer) {
                    if (i === selectorLength) {
                        conkittyError(line, i, 'Unterminated selector');
                    } else {
                        conkittyErrorUnexpectedSymbol(line, i, selector[i]);
                    }
                }

                if (!name.length) {
                    conkittyError(line, attrmodCol, 'No ' + (closer === ']' ? 'attribute' : 'modifier') + ' name');
                }

                name = name.join('');
                value = value.join('');

                if (closer === ']' && !name.match(attrName)) {
                    conkittyError(line, attrmodCol, "Illegal attribute name '" + name + "'");
                } else if (closer === '}' && !name.match(bemName)) {
                    conkittyError(line, attrmodCol, "Illegal modifier name '" + name + "'");

                    if (value && !value.match(bemName)) {
                        conkittyError(line, attrmodCol, "Illegal modifier value '" + value + "'");
                    }
                }

                if (closer === ']') {
                    if (name in attr) {
                        conkittyError(line, attrmodCol, "Attribute '" + name + "' is already set");
                    }

                    if (name === 'class' && className.length) {
                        conkittyError(line, attrmodCol, "Previously assigned 'class' attribute is being rewritten");
                    }

                    attr[name] = value || name;
                } else {
                    if (name in mods) {
                        conkittyError(line, attrmodCol, "Modifier '" + name + "' is already set");
                    }

                    mods[name] = value || true;
                }

                i++;

                if (selector[i] === '[') {
                    processAttrMod(']');
                } else if (selector[i] === '{') {
                    processAttrMod('}');
                }
            };

        i = 0;

        i = skipWhitespaces(selector, i);

        while (i < selectorLength) {
            switch (selector[i]) {
                case '.':
                case '#':
                case '%':
                    processToken();
                    val = [];
                    what = selector[i];
                    whatCol = i + 1;
                    i++;
                    break;

                case '(':
                    if (what !== '%') {
                        conkittyError(line, i, 'Element without a block');
                    }

                    if (bemElem.length) {
                        conkittyError(line, i, 'Duplicate element');
                    }

                    i++;

                    bemElem = [];

                    i = skipWhitespaces(selector, i);

                    while (i < selectorLength && !whitespace.test(selector[i]) && selector[i] !== ')') {
                        bemElem.push(selector[i]);
                        i++;
                    }

                    i = skipWhitespaces(selector, i);

                    if (selector[i] !== ')') {
                        conkittyErrorUnexpectedSymbol(line, i, selector[i]);
                    }

                    i++;

                    if (!bemElem.length) {
                        conkittyError(line, i, 'Empty element name');
                    }

                    bemElem = bemElem.join('');

                    break;

                case '[':
                case '{':
                    processAttrMod(selector[i] === '[' ? ']' : '}');
                    processToken();
                    mods = {};
                    val = [];
                    what = undefined;
                    whatCol = i;

                    break;

                default:
                    val.push(selector[i]);
                    i++;
                    break;
            }
        }

        processToken();

        if (!elem) {
            conkittyError(line, 0, 'No tag name');
        }

        if (className.length) {
            attr['class'] = className.join(' ');
        }

        return {elem: elem, attr: attr};
    }


    function conkittyClearComments() {
        var i,
            j,
            k,
            tmp,
            inComment,
            inString;

        i = 0;
        while (i < code.length) {
            tmp = code[i];

            if (!inComment) {
                inString = false;
                j = 0;

                while (j < tmp.length) {
                    if (tmp[j] === "'" || tmp[j] === '"') {
                        if (inString === tmp[j] && tmp[j - 1] !== '\\') {
                            inString = false;
                            j++;
                            continue;
                        } else if (!inString) {
                            inString = tmp[j];
                            j++;
                            continue;
                        }
                    }

                    if (!inString) {
                        if (tmp[j] === '/' && (tmp[j + 1] === '/' || tmp[j + 1] === '*')) {
                            if (tmp[j + 1] === '*') {
                                k = tmp.indexOf('*/');

                                if (k > j + 1) {
                                    tmp = tmp.substring(0, j) + new Array(k + 3 - j).join(' ') + tmp.substring(k + 2);
                                    continue;
                                } else {
                                    inComment = true;
                                }
                            }

                            tmp = tmp.substring(0, j);
                            break;
                        }
                    }

                    j++;
                }

                code[i] = tmp;
            } else { // In comment.
                k = tmp.indexOf('*/');

                if (k >= 0) {
                    code[i] = new Array(k + 3).join(' ') + tmp.substring(k + 2);
                    inComment = false;
                    i--;
                } else {
                    code[i] = '';
                }
            }

            i++;
        }

        for (i = 0; i < code.length; i++) {
            code[i] = code[i].replace(/\s+$/g, '');
        }
    }


    function conkittyCheckExpression(expr) {
        try {
            var tmp;
            eval('tmp = function() { tmp = ' + expr + '}');
            return tmp;
        } catch(e) {
            e.message = expr + '\n\n' + e.message + '\n';
            throw e;
        }
    }


    function conkittyExtractExpression(index, col, hasMore, noWrap, noReturn) {
        var i = col,
            line = code[index],
            expr = [],
            inString,
            brackets,
            startIndex = index,
            funcName;

        i = skipWhitespaces(line, i);

        funcName =  conkittyGetAnonymousFunctionName(index, i);

        if (line.substring(i).match(/^(?:PAYLOAD)(?:\s|$)/)) {
            expr = '$C._p(_, _.payload)';

            if (!noWrap) {
                expr = 'function ' + funcName + '() { return ' + expr + '; }';
            }

            i = skipWhitespaces(line, i + 7);

            if (i < line.length && !hasMore) {
                conkittyErrorUnexpectedSymbol(index, i, line[i]);
            }

            conkittyCheckExpression(expr);

            return {index: index, col: i, expr: expr};
        } else if (line[i] === '"' || line[i] === "'") {
            var longStr = line.substring(i, i + 3),
                temp,
                noesc;

            if (longStr !== '"""' && longStr !== "'''") {
                longStr = null;
            } else {
                i += 2;
                noesc = true;
            }

            inString = line[i];
            expr.push(line[i++]);

            while (i < line.length && inString) {
                if (line[i] === inString && line[i - 1] !== '\\') {
                    temp = line.substring(i, i + 3);

                    if (!longStr || longStr === temp) {
                        inString = false;
                        if (longStr) {
                            i += 2;
                        }
                        expr.push(line[i++]);
                        break;
                    } else {
                        expr.push('\\');
                    }
                }

                expr.push(line[i++]);
            }

            if (inString) {
                conkittyError(index, i, 'Unterminated string');
            }

            i = skipWhitespaces(line, i);

            if (i < line.length && !hasMore) {
                conkittyErrorUnexpectedSymbol(index, i, line[i]);
            }

            expr = expr.join('');

            conkittyCheckExpression(expr);

            return {index: index, col: i, expr: expr, noesc: noesc};
        } else {
            if (line[i] !== '(') {
                conkittyError(index, i, "Illegal symbol '" + line[i] + "'");
            }

            i++;
            brackets = 1;

            if (i === line.length) {
                index++;

                while (index < code.length && !strip(code[index])) {
                    index++;
                }

                if (index < code.length) {
                    line = code[index];
                    i = 0;
                } else {
                    conkittyError(startIndex, col, 'Unterminated expression');
                }
            }

            while (brackets > 0 && i < line.length) {
                if (!inString) {
                    if (line[i] === '(') {
                        brackets++;
                    } else if (line[i] === ')') {
                        brackets--;

                        if (brackets === 0) {
                            i++;
                            break;
                        }
                    } else if (line[i] === '"' || line[i] === "'") {
                        inString = line[i];
                    }
                } else {
                    if (line[i] === inString && line[i - 1] !== '\\') {
                        inString = false;
                    }
                }

                expr.push(line[i]);

                i++;

                if (i === line.length) {
                    index++;
                    expr.push('\n');

                    while (index < code.length && !strip(code[index])) {
                        index++;
                    }

                    if (index < code.length) {
                        line = code[index];
                        i = 0;
                    } else {
                        conkittyError(startIndex, col, 'Unterminated expression');
                    }
                }
            }

            expr = strip(expr.join(''));

            if (!expr) {
                conkittyError(startIndex, col, 'Empty expression');
            }

            var jsnoesc;

            if (expr.substring(0, 2) === '((' && expr.substring(expr.length - 2) === '))') {
                expr = expr.substring(2, expr.length - 2);
                jsnoesc = true;
            }

            i = skipWhitespaces(line, i);

            if (expr.substring(0, 8) !== 'function') {
                if (noWrap || jsnoesc) {
                    expr = '(' + expr + ')';
                } else {
                    if (noReturn) {
                        expr = 'function ' + funcName + '() { ' + expr + ' }';
                    } else {
                        expr = 'function ' + funcName + '() { return (' + expr + '); }';
                    }
                }
            } else {
                if (noWrap || jsnoesc) {
                    expr = '(' + expr + ').apply(this, arguments)';
                }
            }

            if (i < line.length && !hasMore) {
                conkittyErrorUnexpectedSymbol(index, i, line[i]);
            }

            conkittyCheckExpression(expr);

            return {index: index, col: i, expr: expr, jsnoesc: jsnoesc};
        }
    }


    function conkittyProcessAtAttribute(index, stack, ret) {
        stack[stack.length - 1].end = false;

        var line = code[index],
            i,
            name = [],
            val;

        i = 0;

        i = skipWhitespaces(line, i);

        if (line[i] !== '@') {
            conkittyErrorUnexpectedSymbol(index, i, line[i]);
        }

        i++;

        while (i < line.length && !whitespace.test(line[i])) {
            name.push(line[i]);
            i++;
        }

        name = name.join('');

        if (!name.length || !name.match(attrName)) {
            conkittyError(index, i, "Illegal attribute name '" + name + "'");
        }

        i = skipWhitespaces(line, i);

        val = conkittyExtractExpression(index, i);
        index = val.index;
        val = val.expr;

        addIndent(ret, stack.length);
        ret.push(".attr('" + name + "', " + val + ')\n');

        return index;
    }


    function conkittyProcessTextExpression(index, stack, ret) {
        var expr = conkittyExtractExpression(index, 0);

        if (expr.jsnoesc) {
            var funcName = conkittyGetAnonymousFunctionName(index, skipWhitespaces(code[index], 0));

            addIndent(ret, stack.length);
            ret.push('.act(function ' + funcName + '(__) {\n');
            addIndent(ret, stack.length + 1);
            ret.push('__ = ' + expr.expr + ';\n');
            addIndent(ret, stack.length + 1);
            ret.push('if (__ instanceof Node) { this.appendChild(__); }\n');
            addIndent(ret, stack.length + 1);
            ret.push('else { $C(this).text(__, true).end(); };\n');
            addIndent(ret, stack.length);
            ret.push('})\n');
        } else {
            addIndent(ret, stack.length);
            ret.push('.text(');
            ret.push(expr.expr);
            ret.push((expr.noesc ? ', true' : '') + ')\n');
        }

        index = expr.index;

        stack[stack.length - 1].end = false;

        return index;
    }

    function conkittyProcessCommand(index, stack, ret) {
        var i = 0,
            line = code[index],
            cmd,
            expr,
            expr2,
            args,
            name,
            nameWrapped,
            j,
            k,
            payload,
            payload2,
            funcName;

        stack[stack.length - 1].end = false;

        i = skipWhitespaces(line, i);

        funcName = conkittyGetAnonymousFunctionName(index, i);

        cmd = line.substring(i, i + 4);

        switch (cmd) {
            case 'CHOO':
            case 'OTHE':
                if (startsWith(line, i, 'CHOOSE') || startsWith(line, i, 'OTHERWISE')) {
                    if (strip(line) === 'CHOOSE' || strip(line) === 'OTHERWISE') {
                        stack[stack.length - 1].lastChild = false;

                        addIndent(ret, stack.length);
                        ret.push(cmd === 'CHOO' ? '.choose()\n' : '.otherwise()\n');

                        stack[stack.length - 1].end = true;
                        if (cmd === 'CHOO') {
                            stack[stack.length - 1].choose = true;
                        } else if (stack[stack.length - 2].choose) {
                            delete stack[stack.length - 2].choose;
                        }
                    } else {
                        i = skipWhitespaces(line, i + (cmd === 'CHOO' ? 6 : 9));
                        conkittyErrorUnexpectedSymbol(index, i, line[i]);
                    }
                } else {
                    conkittyError(index, i, 'Unexpected command');
                }

                break;

            case 'TEST':
            case 'ATTR':
            case 'WHEN':
                if ((!whitespace.test(line[i + 4])) || (cmd === 'WHEN' && !stack[stack.length - 2].choose)) {
                    conkittyError(index, i, 'Unexpected command');
                }

                if (i + 4 >= line.length) {
                    conkittyError(index, i + 4, 'Expression is expected');
                }

                stack[stack.length - 1].lastChild = false;

                expr = conkittyExtractExpression(index, i + 4, cmd === 'ATTR');

                index = expr.index;
                i = expr.col;

                break;

            case 'EACH':
                i += 4;

                if (i >= line.length) {
                    conkittyError(index, i, 'Expression is expected');
                }

                if (!whitespace.test(line[i])) {
                    conkittyError(index, i, 'Unexpected command');
                }

                stack[stack.length - 1].lastChild = false;

                i = j = k = skipWhitespaces(line, i);

                var keyVarName,
                    valVarName,
                    exprStarters = {'"': true, "'": true, '(': true};

                if (!(line[i] in exprStarters)) {
                    keyVarName = [];
                    while (i < line.length && !whitespace.test(line[i])) {
                        keyVarName.push(line[i]);
                        i++;
                    }

                    i = skipWhitespaces(line, i + 1);

                    if (i < line.length) {
                        keyVarName = keyVarName.join('');
                        conkittyCheckName(index, j, keyVarName);

                        j = i;

                        if (!(line[i] in exprStarters)) {
                            valVarName = [];
                            while (i < line.length && !whitespace.test(line[i])) {
                                valVarName.push(line[i]);
                                i++;
                            }

                            i = skipWhitespaces(line, i + 1);

                            if (i < line.length) {
                                valVarName = valVarName.join('');
                                conkittyCheckName(index, j, valVarName);
                            } else {
                                i = j;
                                valVarName = keyVarName;
                                keyVarName = undefined;
                            }
                        } else {
                            valVarName = keyVarName;
                            keyVarName = undefined;
                        }
                    } else {
                        i = k;
                        keyVarName = undefined;
                    }
                }

                expr = conkittyExtractExpression(index, i);

                index = expr.index;
                i = expr.col;

                addIndent(ret, stack.length);
                ret.push('.each(' + expr.expr + ')\n');

                if (keyVarName || valVarName) {
                    if (keyVarName) {
                        variables[keyVarName] = true;
                    }

                    variables[valVarName] = true;

                    addIndent(ret, stack.length + 1);
                    ret.push('.act(function(_' + (keyVarName ? ', __' : '') + ') { ');
                    ret.push(valVarName + ' = _; ');
                    if (keyVarName) {
                        ret.push(keyVarName + ' = __; ');
                    }
                    ret.push('})\n');
                }

                stack[stack.length - 1].end = true;

                break;

            case 'CALL':
            case 'WITH':
                args = [];
                name = [];
                j = i;

                if (!whitespace.test(line[i + 4])) {
                    conkittyError(index, i, 'Unexpected command');
                }

                i = skipWhitespaces(line, i + 4);

                if (cmd === 'CALL' && line[i] === '(') {
                    expr = conkittyExtractExpression(index, i, true, true);

                    index = expr.index;
                    i = expr.col;
                    line = code[index];

                    nameWrapped = '[' + expr.expr + ']';
                } else {
                    while (i < line.length && !whitespace.test(line[i])) {
                        name.push(line[i]);
                        i++;
                    }

                    if (!name.length) {
                        conkittyError(index, i, 'No name');
                    }

                    name = name.join('');

                    conkittyCheckName(index, i - name.length, name, cmd === 'CALL');

                    nameWrapped = "['" + name + "']";
                }

                i = skipWhitespaces(line, i);

                while (i < line.length) {
                    expr = conkittyExtractExpression(index, i, cmd === 'CALL', true);
                    index = expr.index;
                    i = expr.col;
                    line = code[index];
                    args.push(expr.expr);
                }

                if (cmd === 'WITH' && !args.length) {
                    conkittyError(index, i, 'Expression is expected');
                }

                index++;

                payload = conkittyCompile(undefined, stack[stack.length - 1].indent, index);
                index = payload.index;
                payload = payload.ret;

                if (index + 1 < code.length) {
                    line = code[index + 1];
                    i = skipWhitespaces(line, 0);

                    if (i === stack[stack.length - 1].indent &&
                        line.substring(i, i + 4) === 'ELSE' &&
                        (i + 4 === line.length || whitespace.test(line[i + 4])))
                    {
                        i = skipWhitespaces(line, i + 4);

                        if (i < line.length) {
                            conkittyErrorUnexpectedSymbol(index + 1, i);
                        }

                        index += 2;

                        payload2 = conkittyCompile(undefined, stack[stack.length - 1].indent, index);
                        index = payload2.index;
                        payload2 = payload2.ret;
                    }
                }

                addIndent(ret, stack.length);

                k = (new Array(stack.length)).join(indentWith);

                if (payload2) {
                    payload2 = payload2.replace('$C()', '$C(this)');
                    payload2 = strip(payload2).split('\n').join('\n' + k + indentWith);
                }

                if (cmd === 'WITH') {
                    variables[name] = true;

                    expr = args[0];

                    if (payload) {
                        payload = payload.replace('$C()', '$C(this)');
                        payload = strip(payload).split('\n').join('\n' + k + indentWith);
                    }

                    ret.push('.act(function ' + funcName + '() {\n');

                    addIndent(ret, stack.length + 1);
                    ret.push('try { ' + name + ' = ' + expr + ' } catch($C_e) { ' + name + ' = undefined; }\n');
                    addIndent(ret, stack.length + 1);
                    ret.push('if (' + name + ' === undefined || ' + name + ' === null) {\n');
                    addIndent(ret, stack.length + (payload2 ? 2 : 1));

                    if (payload2) {
                        ret.push(payload2);
                        ret.push('\n');
                        addIndent(ret, stack.length + 1);
                    }

                    if (payload) {
                        ret.push('} else {\n');
                        addIndent(ret, stack.length + 2);
                        ret.push(payload);
                        ret.push('\n');
                        addIndent(ret, stack.length + 1);
                    }

                    ret.push('}\n');

                    addIndent(ret, stack.length);
                    ret.push('})\n');
                } else {
                    ret.push('.act(function ' + funcName + '(' + (payload ? '__' : '') + ') {\n');

                    if (payload) {
                        ret.push(k + indentWith);
                        ret.push('__ = function() {\n');
                        ret.push(k + indentWith + indentWith);
                        ret.push('return ');
                        ret.push(strip(payload).split('\n').join('\n' + k + indentWith));
                        ret.push(';\n');
                        ret.push(k + indentWith + '};\n');
                    }

                    if (payload2) {
                        ret.push(k + indentWith + 'try {\n');
                    }

                    ret.push(k + indentWith);
                    if (payload2) { ret.push(indentWith); }
                    ret.push('$C.tpl' + nameWrapped + '({parent: this');

                    if (payload) {
                        ret.push(', payload: __');
                    }

                    ret.push('}');

                    if (args.length) {
                        ret.push(',\n' + k + indentWith + indentWith);
                        if (payload2) { ret.push(indentWith); }
                        ret.push(args.join(',\n' + k + indentWith + indentWith + (payload2 ? indentWith : '')));
                        ret.push('\n' + k + indentWith);
                        if (payload2) { ret.push(indentWith); }
                    }

                    ret.push(');\n');

                    if (payload2) {
                        ret.push(k + indentWith);
                        ret.push('} catch($C_e) {\n');
                        ret.push(k + indentWith + indentWith);
                        ret.push(payload2);
                        ret.push('\n');
                        ret.push(k + indentWith);
                        ret.push('}\n');
                    }

                    addIndent(ret, stack.length);
                    ret.push('})\n');
                }

                break;

            case 'SET':
            case 'SET ':
                if (!startsWith(line, i, 'SET')) {
                    conkittyError(index, i, 'Unexpected command');
                }

                name = [];

                i = skipWhitespaces(line, i + 3);

                j = i;

                while (i < line.length && !whitespace.test(line[i])) {
                    name.push(line[i]);
                    i++;
                }

                if (!name.length) {
                    conkittyError(index, j, 'No name');
                }

                name = name.join('');
                conkittyCheckName(index, j, name);

                variables[name] = true;

                i = skipWhitespaces(line, i);

                if (i < line.length) {
                    expr = conkittyExtractExpression(index, i, false, true);
                    index = expr.index;
                    i = expr.col;
                    line = code[index];
                    expr = expr.expr;
                }

                j = index + 1;

                payload = conkittyCompile(undefined, stack[stack.length - 1].indent, index + 1);
                index = payload.index;
                payload = payload.ret;

                if (payload && expr) {
                    i = skipWhitespaces(code[j], 0);
                    conkittyError(j, i, 'Duplicate variable content');
                }

                if (!payload && !expr) {
                    j--;
                    conkittyError(j, i, 'No value');
                } else if (payload) {
                    expr = payload;
                }

                addIndent(ret, stack.length);

                k = (new Array(stack.length)).join(indentWith);

                ret.push('.act(function ' + funcName + '() {\n' + k + indentWith + name + ' = ');
                ret.push(strip(expr).split('\n').join('\n' + k));
                if (payload) {
                    ret.push(';\n' + k + indentWith + name + ' = ' + name + '.firstChild ? ' + name + ' : undefined');
                }
                ret.push(';\n');

                addIndent(ret, stack.length);
                ret.push('})\n');

                break;

            case 'PAYL':
                if (startsWith(line, i, 'PAYLOAD')) {
                    i = skipWhitespaces(line, i + 7);
                    if (i < line.length) {
                        conkittyErrorUnexpectedSymbol(index, i, line[i]);
                    }

                    addIndent(ret, stack.length);

                    ret.push('.act(function ' + funcName + '() { $C._p(_, _.payload, this); })\n');
                } else {
                    conkittyError(index, i, 'Unexpected command');
                }

                break;

            case 'MEM':
            case 'MEM ':
                if (!startsWith(line, i, 'MEM')) {
                    conkittyError(index, i, 'Unexpected command');
                }

                i = skipWhitespaces(line, i + 3);

                expr = conkittyExtractExpression(index, i, true);
                index = expr.index;
                i = expr.col;
                line = code[index];
                expr = expr.expr;

                if (i < line.length) {
                    expr2 = conkittyExtractExpression(index, i);
                    index = expr2.index;
                    i = expr2.col;
                    line = code[index];
                    expr2 = expr2.expr;
                } else {
                    expr2 = undefined;
                }

                addIndent(ret, stack.length);

                k = (new Array(stack.length)).join(indentWith);

                ret.push('.mem(');
                ret.push(strip(expr).split('\n').join('\n' + k));

                if (expr2) {
                    ret.push(', ');
                    ret.push(strip(expr2).split('\n').join('\n' + k));
                }

                ret.push(')\n');

                break;

            case 'ACT':
            case 'ACT ':
                if (!startsWith(line, i, 'ACT')) {
                    conkittyError(index, i, 'Unexpected command');
                }

                i = skipWhitespaces(line, i + 3);

                if (line[i] !== '(') {
                    conkittyError(index, i, 'Expression is expected');
                }

                expr = conkittyExtractExpression(index, i, false, false, true);
                index = expr.index;
                i = expr.col;
                line = code[index];
                expr = expr.expr;

                addIndent(ret, stack.length);

                k = (new Array(stack.length)).join(indentWith);

                ret.push('.act(');
                ret.push(strip(expr).split('\n').join('\n' + k));
                ret.push(')\n');

                break;

            case 'TRIG':
                if (!startsWith(line, i, 'TRIGGER')) {
                    conkittyError(index, i, 'Unexpected command');
                }

                i = skipWhitespaces(line, i + 7);

                args = [];

                while (i < line.length) {
                    expr = conkittyExtractExpression(index, i, true, true);
                    index = expr.index;
                    i = expr.col;
                    line = code[index];
                    args.push(expr.expr);
                }

                addIndent(ret, stack.length);

                k = (new Array(stack.length)).join(indentWith);

                ret.push('.trigger(');

                if (args.length) {
                    ret.push('\n' + k + indentWith + (args.join(',\n' + k + indentWith)) + '\n' + k);
                }

                ret.push(')\n');

                break;

            default:
                conkittyError(index, i, 'Unexpected command');
        }

        switch (cmd) {
            case 'TEST':
            case 'WHEN':
                addIndent(ret, stack.length);
                ret.push((cmd === 'TEST' ? '.test(' : '.when(') + expr.expr + ')\n');
                stack[stack.length - 1].end = true;

                break;

            case 'ATTR':
                expr2 = conkittyExtractExpression(index, i);

                index = expr2.index;
                i = expr2.col;

                addIndent(ret, stack.length);
                ret.push('.attr(' + expr.expr + ', ' + expr2.expr + ')\n');

                break;
        }

        return index;
    }

    function conkittyProcessElement(index, stack, ret) {
        var elem = conkittyTokenizeSelector(index, code[index]),
            hasAttr,
            needComma;

        for (hasAttr in elem.attr) {
            break;
        }

        stack[stack.length - 1].lastChild = false;

        addIndent(ret, stack.length);

        if (elem.elem in TAG_FUNCS) {
            ret.push('.' + elem.elem + '(');
            needComma = '';
        } else {
            ret.push(".elem('" + elem.elem + "'");
            needComma = ', ';
        }

        if (hasAttr) {
            ret.push(needComma + JSON.stringify(elem.attr));
        }

        ret.push(')\n');

        stack[stack.length - 1].end = true;
    }


    function conkittyProcess(index, stack, ret) {
        var line = strip(code[index]);

        switch (line[0]) {
            case '"':
            case "'":
            case '(':
                index = conkittyProcessTextExpression(index, stack, ret);
                break;

            case '@':
                index = conkittyProcessAtAttribute(index, stack, ret);
                break;

            default:
                stack[stack.length - 1].end = true;
                if (/[A-Z]/.test(line[0])) {
                    index = conkittyProcessCommand(index, stack, ret);
                } else {
                    conkittyProcessElement(index, stack, ret);
                }
        }

        return index;
    }


    function conkittyInsertVariables(ret) {
        var args = [],
            v;

        for (v in variables) {
            args.push(v);
        }

        ret.splice(1, 0, indentWith + '_ = _ || {};\n' + (args.length ? indentWith + 'var ' + args.join(', ') + ';\n' : ''));
    }


    conkittyCompile = function(src, minIndent, startIndex) {
        if (!startIndex) {
            source = src.split(/\n\r|\r\n|\r|\n/);
            code = src.split(/\n\r|\r\n|\r|\n/);
            conkittyClearComments();
        }

        var compiled = {},
            curTpl,
            template,
            ret = [],
            i,
            j,
            k,
            ends,
            line,
            stack = [{indent: -1}],
            tabs,
            spaces,
            args,
            name;

        if (minIndent) {
            stack.push({indent: minIndent, end: true, lashChild: true});
            ret.push('$C()\n');
        }

        for (i = startIndex || 0; i < code.length; i++) {
            line = code[i];

            if (!line) {
                continue;
            }

            j = 0;
            while (j < line.length && whitespace.test(line[j])) {
                if (line[j] === '\t') {
                    tabs = true;
                } else if (line[j] === ' ') {
                    spaces = true;
                } else {
                    conkittyError(i, j, 'Unexpected symbol (only tabs or spaces are allowed here)');
                }

                if (tabs && spaces) {
                    conkittyError(i, j, 'Please, never ever mix tabs and spaces');
                }

                j++;
            }

            k = j;
            ends = 0;

            if ((j > stack[stack.length - 1].indent) && stack[stack.length - 1].lastChild) {
                conkittyError(i, j, 'Bad indentation');
            }

            while (j <= stack[stack.length - 1].indent) {
                k = stack.pop();

                if (k.end) {
                    ends++;
                }

                k = k.indent;
            }

            if (ends > 0) {
                addIndent(ret, stack.length + 1);
                ret.push('.end(' + (ends > 1 ? ends : '') + ')\n');
            }

            if ((k !== j) && (!minIndent || (minIndent && (j > minIndent)))) {
                conkittyError(i, j, 'Bad indentation');
            }

            if (j >= stack[stack.length - 1].indent) {
                if (j > stack[stack.length - 1].indent) {
                    k = {indent: j, lastChild: true};
                    if (stack.push(k) === 2) {
                        k.end = true;
                        k.lastChild = false;
                    }
                }

                if (stack.length > 2) {
                    i = conkittyProcess(i, stack, ret);
                } else {
                    if (curTpl) {
                        addIndent(ret, 1);
                        ret.push('}');

                        conkittyInsertVariables(ret);

                        ret.push(';');
                        ret = ret.join('');

                        try {
                            if (eval('template = ' + ret) && template) {
                                compiled[curTpl] = ret;
                            }
                        } catch (e) {
                            e.message = ret + '\n\n' + e.message + '\n';
                            throw e;
                        }

                        ret = [];
                    }

                    if (!minIndent) {
                        args = [];
                        name = [];

                        k = skipWhitespaces(line, 0);
                        line += ' ';

                        while (k < line.length) {
                            if (whitespace.test(line[k])) {
                                if (name.length) {
                                    name = name.join('');
                                    conkittyCheckName(i, k - name.length, name, true);
                                    args.push(name);
                                    name = [];
                                }
                            } else {
                                name.push(line[k]);
                            }

                            k++;
                        }

                        curTpl = currentTemplateName = args[0];

                        variables = {};

                        args.shift();
                        ret.push('function(_' + (args.length ? ', ' + args.join(', ') : '') + ') {\n');
                        addIndent(ret, stack.length);
                        ret.push('return $C(_.parent)\n');
                    } else {
                        // It's a PAYLOAD for CALL command or SET command.
                        break;
                    }
                }
            }
        }

        if (stack.length > 1) {
            ends = 0;

            if (minIndent && i < code.length) {
                stack.pop();
            }

            while (stack.length > 1) {
                k = stack.pop();

                if (k.end) {
                    ends++;
                }
            }

            if (ends > 0) {
                addIndent(ret, 2);
                ret.push('.end(' + (ends > 1 ? ends : '') + ')\n');
            }

            if (!minIndent) {
                ret.push('}');
            } else if (ret.length <= 3) {
                // Empty payload, just skip it.
                ret = [];
            }

            if (minIndent) {
                return {index: i - 1, ret: ret.join('')};
            } else {
                conkittyInsertVariables(ret);

                ret.push(';');
                ret = ret.join('');

                try {
                    if (eval('template = ' + ret) && template) {
                        compiled[curTpl] = ret;
                    }
                } catch (e) {
                    e.message = ret + '\n\n' + e.message + '\n';
                    throw e;
                }
            }
        }

        return compiled;
    };

})();

// Exporting conkittyCompile for command line interface.
if (typeof module !== 'undefined') {
    module.exports = conkittyCompile;
}
