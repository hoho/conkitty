'use strict';

var uglify = require('uglify-js'),
    jsParser = uglify.parser,
    jsUglify = uglify.uglify;


function parseJS(code, stripFunc) {
    /* jshint -W106 */
    var ast = jsParser.parse(code);

    ast = jsUglify.ast_lift_variables(ast);

    // Strip f() call.
    if (stripFunc) {
        stripFunc(ast);
    }

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


function adjustJS(ast, beautify) {
    /* jshint -W106 */
    return jsUglify.gen_code(ast, {beautify: beautify, indent_start: 0});
    /* jshint +W106 */
}


module.exports.parseJS = parseJS;
module.exports.parseJSExpression = parseJSExpression;
module.exports.parseJSFunction = parseJSFunction;
module.exports.adjustJS = adjustJS;

