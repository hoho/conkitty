Conkitty Template Engine
========================

Conkitty templates are being compiled to
[concat.js](https://github.com/hoho/concat.js) chains.

## Quick start

Two quick start options are available:

* `npm install -g conkitty` and `conkitty file.ctpl` will print compiled
  `file.ctpl` file.
* Use [grunt-conkitty](https://github.com/hoho/grunt-conkitty)
  to build Conkitty templates with [Grunt](http://gruntjs.com/).

To start using compiled templates:

* Link [concat.js](https://github.com/hoho/concat.js) to your page *(about 1.3 Kb gzipped)*;
* link compiled templates to your page;
* link [callTemplate](https://github.com/hoho/conkitty/blob/master/callTemplate/conkittyCallTemplate.js)
  function to your page *(less than 200 bytes and optional, you can use
  `$C.tpl['template-name']` functions directly)*.

You can install all of these from [Bower](http://bower.io) or [npm](http://npmjs.org/)
repositories.

There is a Conkitty syntax highlighting plugin for JetBrains products
(IntelliJ IDEA, WebStorm, PhpStorm and so on). It is available from
[official plugin repository](http://plugins.jetbrains.com/plugin/7348).

```html
<html>
    <head>
        <title>Hello</title>
    </head>
    <body>
        <script src="/path/to/concat.js"></script>
        <script src="/path/to/compiled/templates"></script>
        <script src="/path/to/callTemplate"></script>
        <script>
            // Insert `template-name` result into document body right away.
            $C.callTemplate(document.body, 'template-name', 'Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'});
        </script>
    </body>
</html>
```

Check out [this example](https://github.com/hoho/conkitty/tree/master/example)
to see how dependencies and compiled templates could be stuck together using
[grunt-conkitty](https://github.com/hoho/grunt-conkitty).

# Syntax (description is in painful progress)

Block nesting is done by indentation. Top level (zero-indented lines) is for
template declaration. Below template declaration are commands, tags, strings
and JavaScript expressions.

    template-name arg1 arg2 arg3
        h1
            (arg1)
        ul
            EACH item (arg2)
                li
                    "Item: "
                    (item)
        dl
            EACH key val (arg3)
                dt
                    (key)
                dd
                    (val)

    // $C.callTemplate('template-name', 'Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'}) will produce:
    //
    // <h1>Hello</h1>
    // <ul>
    //     <li>Item: 1</li>
    //     <li>Item: 2</li>
    //     <li>Item: 3</li>
    // </ul>
    // <dl>
    //     <dt>k1</dt>
    //     <dd>v1</dd>
    //     <dt>k2</dt>
    //     <dd>v2</dd>
    // </dl>


## Template declaration

`template-name [arg1 [arg2 […]]]`

Where `template-name` is a name of the template, this name is used to call this
template. When you call the template, you can pass any number of arguments into
it. These arguments will be accessible from JavaScript expressions of the
template via appropriate names. Argument names should be a valid JavaScript
variable names.

## Strings

Strings are enclosed in single or double quotes. String should begin and end
in the same line. String will be properly escaped in the result.

**Good**

    "Hello world"

    'Hello \'world\''

    "Hello <world>"

**Bad**

    "Hello
       world"

## JavaScript expressions

JavaScript expressions are enclosed in parenthesis. A JavaScript expression
value will be coerced to string and properly escaped in the result.
You can pass a function expression, this function will be called.

**Good**

    (1 + 2 + 3)

    ('Hello ' + Math.random() + ' world')

    (function() {
         // Expressions could be multiline.
         // `this` is pointing to current DOM node.
         return this.innerHTML + this.innerHTML;
    })

**Bad**

    ()

    (())

    (return 123)


## Tags

    // Create <div class="test"></div>
    div.test

    // Create <a id="ppp" class="hello world" href="http://xslc.org"></a>
    a#ppp.hello.world[href="http://xslc.org/"]

    // Create <a href="http://xslc.org/" data-rnd="0.8223862457089126">Yo</a>
    a
        @href "http://xslc.org/"
        @data-rnd (Math.random())
        "Yo"

## Commands

### ACT *expr*

Run arbitrary JavaScript code.

*expr* is a valid JavaScript code enclosed in parenthesis. If *expr* is a
function, this function will be called.

    template1
        div
            ACT (window.everythingIsOk = true)
            p
                "Hello world"
                ACT (function() { window.functionIsOkToo = 'yes'; })

    // $C.callTemplate('template1') will produce: <div><p>Hello world</p></div>,
    // `window.everythingIsOk` and `window.functionIsOkToo` will be set to
    // true and 'yes' respectively.


### ATTR *name* *value*

This command should be used to add an attribute with a dynamic name.

*name* and *value* are strings or JavaScript expressions.

    // Create <div id="yep"></div> or <div class="yep"></div>
    div
        ATTR (Math.random() < 0.5 ? 'id' : 'class') "yep"

### CALL *template-name [arg1 [arg2 […]]]*

You can call one template from another. argN are strings or JavaScript expressions.

    // Calling template1 will create <div><h1>Hello world!</h1></div>
    template1
        div
            CALL template2 "Hello" (' wo' + 'rld')

    template2 arg1 arg2
        h1
            (arg1)
            (arg2)
            "!"

You can pass a subtree when you call a template.

    // Calling template1 will create <div><h1>Hello world<span>!</span></h1></div>
    template1
        div
            CALL template2 "Hello world"
                span
                    "!"

    template2 arg1
        h1
            (arg1)
            PAYLOAD

### CHOOSE

`CHOOSE` is a command to choose one of multiple choices.

    template1 arg1
        CHOOSE
            WHEN (arg1 === 1)
                div
                    "111"
            WHEN (arg1 === 2)
                span
                    "222"
            OTHERWISE
                p
                    (arg1 + ' aaa ' + arg1)

    // $C.callTemplate('template1', 1) will produce: <div>111</div>.
    // $C.callTemplate('template1', 2) will produce: <span>222</span>.
    // $C.callTemplate('template1', 3) will produce: <p>3 aaa 3</p>.

Any number of `WHEN` sections is possible. `OTHERWISE` is an optional section.

### EACH *[key] value* *expr*

Iterate over an array or an object.

*key* and *value* are identifiers to access the data from JavaScript
expressions. They should be a valid JavaScript variable names. *key* is
optional.

*expr* is a JavaScript expression returns an array or an object.

    template1
        EACH val ([11, 22])
            p
                (val + ' aa ' + val)

        EACH index val ([33, 44])
            span
                (index)
                ": "
                (val)

        EACH vvv ({k1: 'v1', k2: 'v2'})
            div
                (vvv)

        EACH k v ({k3: 'v3', k4: 'v4'})
            em
                (k)
                ": "
                (v)

    // This template will produce:
    //
    // <p>11 aa 11</p>
    // <p>22 aa 22</p>
    // <span>0: 33</span>
    // <span>1: 44</span>
    // <div>v1</div>
    // <div>v2</div>
    // <em>k3: v3</em>
    // <em>k4: v4</em>

### MEM *key* *[expr]*

You have an access to exact DOM nodes during their creation process. You can
memorize some of these nodes for future use.

    template1
        div
            MEM "my-div"

            p
                MEM ('my' + '-' + 'p') ({ppp: this})

    // var ret = $C.callTemplate(document.body, 'template1');
    // `ret` will be {'my-div': div, 'my-p': {'ppp': p}}

### SET *name* *expr*

*name* is a valid JavaScript variable name.

*expr* is a JavaScript expression for a variable value.

Sometimes you need to define a variable.

    template1
        div
            SET myvar ({some: 'data', inside: '.'})

            (myvar.some + myvar.inside)

            // You can reuse variable names.
            SET myvar ({another: 'value'})

            (myvar.another)

    // This template will produce:
    // <div>data.value</div>

You can also assign a subtree to a variable.

    template2
        SET myvar2
            em
                "hello"
            strong
                "world"

        div
            // Use unescaped JavaScript expression (see below) to insert the result.
            (((myvar2)))

    // This template will produce:
    // <div><em>hello</em><strong>world</strong></div>

### TEST *expr*

`TEST` is a simplified `CHOOSE` for the cases you have only one option to check.

    template1 title
        TEST (title)
            h1
                (title)
        p
            "Some content"

    // $C.callTemplate(document.body, 'template1', 'Tiiiiiii') will produce:
    // <h1>Tiiiiiii</h1><p>Some content</p>

    // $C.callTemplate(document.body, 'template1') will produce:
    // <p>Some content</p>

### WITH *name* *expr*

*name* is a valid JavaScript variable name.

*expr* is a JavaScript expression.

    template1
        div
            SET v ({a: {b: {c: 'd', e: false}}})

            div
                WITH ok (v.a.b.c)
                    (ok)
                ELSE
                    "FUCK"

            div
                // Go to ELSE section in case of exception.
                WITH ok (v.e.f.g)
                    (ok)
                ELSE
                    "FUCK"

            div
                WITH ok (v.a.b.e)
                    (ok)
                ELSE
                    "FUCK"

            div
                // Go to ELSE section in case of undefined value.
                WITH ok (v.a.b.no)
                    (ok)
                ELSE
                    "FUCK"

    // This template will produce:
    //
    // <div>d</div>
    // <div>FUCK</div>
    // <div>false</div>
    // <div>FUCK</div>

## Unescaped strings

A string like `"&nbsp;"` will produce `&amp;nbsp;` in the result. To put an
unescaped text to the result, enclose a string in triple quotes. Note that the
markup inside triple quotes should be valid.

**Good**

    """Hello&nbsp;world"""

    '''<p>Hello <strong>world</strong></p>'''

**Bad**

    """</div>"""

## Unescaped JavaScript expressions

When you use a JavaScript expression to insert something to the result, its
value is coerced to a properly escaped string. Sometimes you have a DOM
node as a template argument or you want to insert an unescaped JavaScript
expression value. To do that, enclose your JavaScript expression in triple
parenthesis. When you do that, typecheck is performed, if your JavaScript
expression value is an instance of Node, it will be inserted as node,
otherwise the value will be coerced to a string and this string will be
inserted unescaped (note that the markup should be valid).

*Please, keep in mind, that if you need unescaped JavaScript expressions often,
you are probably doing something wrong.*

    template1
        div
            CALL template2
                span
                    "some DOM inside"

            ('<em>' + 'no, it is not' + '</em>')
            ((('<strong>' + 'yes, it is' + '</strong>')))

    template2
        p
            // Pass this template's PAYLOAD as an argument to next template.
            CALL template3 PAYLOAD

    template3 arg
        "This is not "

        (arg)

        ", this is "

        (((arg)))

        " indeed."

    // This template will produce:
    //
    // <div>
    //     <p>
    //         This is not [object DocumentFragment], this is <span>some DOM inside</span> indeed.
    //     </p>
    //     &lt;em&gt;no, it is not&lt;/em&gt;
    //     <strong>yes, it is</strong>
    // </div>