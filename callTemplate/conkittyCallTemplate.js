/*

An example of a function to call Conkitty templates (when these templates are
already compiled and loaded).

Usage:
    $C.callTemplate([parent,] templateName [, arg1, arg2, ...]);

    `parent`
        A DOM node to insert the result to.
    `templateName`
        A name of a template to call.
    `arg1`, `arg2`, ...
        Arguments to pass to a template.

Example:

// Say, we've compiled and loaded this template:
my-template title, anything
    div.my-div
        MEM "my-div"
        h1
            MEM "t"
            (title)
        div.my-content
            "This is: "
            (anything + ', ' + anything)

// We call callTemplate function.
var ret1 = $C.callTemplate('my-template', 'Tititi', 'aaaa');
// `ret1` will be `docFrag`, `$C.mem` will be {'my-div': node1, 't': node2}

var ret2 = $C.callTemplate(document.body, 'my-template', 'Tatata', 'bbbb');
// `ret2` will be undefined, `$C.mem` will be {'my-div': node1, 't': node2}

// Where `node1` and `node2` are references to appropriate memorized
// nodes (`div` and `h1`), `docFrag` is the result of first `$C.callTemplate`
// execution. Second `$C.callTemplate` execution result will be inserted into
// `document.body` right away.

*/
$C.callTemplate = function callTemplate(parent, name/*, ...*/) {
    var meta = {},
        tplName,
        args;

    if (parent instanceof Node) {
        meta.parent = parent;
        tplName = name;
        args = 1;
    } else {
        tplName = parent;
        args = 0;
    }

    args = Array.prototype.slice.call(arguments, args);
    args[0] = meta;

    // Reuse `parent` variable to get template function.
    if ((parent = $C.tpl[tplName])) {
        return parent.apply(null, args);
    } else {
        throw new Error('No template named "' + tplName + '"');
    }
};
