/*

An example of a function to call Conkitty templates (when these templates are
already compiled and loaded).

Usage:
    $C.callTemplate([parent,] templateName [, arg1, arg2, ...]);

    `parent`
        A DOM node to insert the result to.
    `templateName`
        A name of template to call.
    `arg1`, `arg2`, ...
        Arguments to pass to a template.

Return value is a dictionary of everything memorized with `MEM` command during
template execution. This dictionary contains result's documentFragment in case
`parent` is not passed (documentFragment's key is `dom`).

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
var ret2 = $C.callTemplate(document.body, 'my-template', 'Tatata', 'bbbb');

// `ret1` will be {'my-div': node1, 't': node2, 'dom': docFrag}
// `ret2` will be {'my-div': node1, 't': node2}

// Where `node1` and `node2` are references to appropriate memorized
// nodes (`div` and `h1`), `docFrag` is the result of first `$C.callTemplate`
// execution. Second `$C.callTemplate` execution result will be inserted into
// `document.body` right away.

*/
$C.callTemplate = function callTemplate(parent, name/*, ...*/) {
    var meta = {},
        tpl,
        start,
        args;

    if (parent instanceof Node) {
        meta.parent = parent;
        start = 1;
    } else {
        name = parent;
        start = 0;
    }

    args = Array.prototype.slice.call(arguments, start);
    args[0] = meta;

    if ((tpl = $C.tpl[name])) {
        return tpl.apply(null, args);
    } else {
        throw new Error('No template named "' + name + '"');
    }
};
