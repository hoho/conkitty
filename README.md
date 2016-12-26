# Conkitty Template Engine [![Build Status](https://travis-ci.org/hoho/conkitty.svg?branch=master)](https://travis-ci.org/hoho/conkitty)

Conkitty templates are being compiled to
[concat.js](https://github.com/hoho/concat.js) chains. It is not a regular
template engine, it doesn't produce strings of HTML, but generates DOM instead.

*Documentation is in painful progress, but it is better than nothing.*

- [Quick start](#quick-start)
- [Syntax](#syntax)
- [Template declaration](#template-declaration)
- [Strings](#strings)
- [JavaScript expressions](#javascript-expressions)
- [Tags](#tags)
- [Variables](#variables)
- [Commands](#commands)
    - [ATTR *name* *value*](#attr-name-value)
    - [CALL *template-name [arg1 [arg2 […]]]*](#call-template-name-arg1-arg2-)
    - [CHOOSE](#choose)
    - [EACH *[$key] $value* *expr*](#each-key-value-expr)
    - [JS *[$item $index $obj]*](#js-item-index-obj)
    - [MEM *key* *[expr]*](#mem-key-expr)
    - [SET *$name* *expr*](#set-name-expr)
    - [TEST *expr*](#test-expr)
    - [TRIGGER *[arg1 [arg2 […]]]*](#trigger-arg1-arg2-)
    - [WITH *$name* *expr*](#with-name-expr)
- [Unescaped strings](#unescaped-strings)
- [Unescaped JavaScript expressions](#unescaped-javascript-expressions)
- [Line wrap](#line-wrap)
- [Namespaced templates](#namespaced-templates)
- [Remembering created nodes](#remembering-created-nodes)
- [Returning more from templates](#returning-more-from-templates)
- [Node appender](#node-appender)
- [External files dependency declaration](#external-files-dependency-declaration)
- [Precompile expressions](#precompile-expressions)
- [Generated code notes](#generated-code-notes)
- [Source maps](#source-maps)
- [Performance notes](#performance-notes)


## Quick start

Three quick start options are available:

* `npm install -g conkitty` and `conkitty -c common.js -t tpl.js file.ctpl`
  will compile `file.ctpl` to `common.js` and `tpl.js` files.
* Use [grunt-conkitty](https://github.com/hoho/grunt-conkitty)
  to build Conkitty templates with [Grunt](http://gruntjs.com/), check out
  [this example](https://github.com/hoho/conkitty/tree/master/example).
* Use [gulp-conkitty](https://github.com/hoho/gulp-conkitty)
  to build Conkitty templates with [Gulp](http://gulpjs.com/), check out
  [this example](https://github.com/hoho/conkitty/tree/master/example2) (it has
  example dependencies).

Compiled templates consist of two and a half parts:

* Common core code needed for runtime,
* compiled templates code,
* external dependencies (in case they are declared in templates).

To start using compiled templates, link common core and compiled templates
to your page with `<script>` tags.

There is a Conkitty syntax highlighting plugin for JetBrains products
(IntelliJ IDEA, WebStorm, PhpStorm and so on). It is available from
[official plugin repository](http://plugins.jetbrains.com/plugin/7348).

```html
<html>
    <head>
        <title>Hello</title>
    </head>
    <body>
        <script src="/path/to/common.js"></script>
        <script src="/path/to/compiled/templates.js"></script>
        <script>
            // Insert `template-name` result into document body right away.
            $C.tpl['template-name'].call(document.body, 'Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'});

            // The same, but assign generated DOM to a variable.
            var rendered = $C.tpl['template-name']('Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'});
            document.body.appendChild(rendered);
            // `rendered` is a document fragment, so, it's not a valid reference
            // after you call appendChild for it.
        </script>
    </body>
</html>
```


# Syntax

Block nesting is done via indentation. Top level (zero-indented lines) is for
templates declarations. Below each template declaration are commands, tags,
strings, variables and JavaScript expressions.

    template-name $arg1 $arg2 $arg3
        h1
            $arg1
        ul
            EACH $item $arg2
                li
                    "Item: "
                    $item
        dl
            EACH $key $val $arg3
                dt
                    $key
                dd
                    $val

    // $C.tpl['template-name']('Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'}) will produce:
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

`template-name [$arg1 [$arg2 […]]]`

Where `template-name` is a name of the template, this name is used to call the
template. When you call the template, you can pass any number of arguments to
it. These arguments will be accessible from JavaScript expressions of the
template via appropriate names. Argument names should be a `$` sign plus a
valid JavaScript variable names.

    template1 $arg1 $arg2
        h1
            $arg1
        p
            ($arg2 + ' ' + $arg2) // JavaScript expression, arguments are
                                  // accessible here too.

    // $C.tpl.template1('Hello', 'World') will produce:
    //
    //  <h1>Hello</h1>
    //  <p>World World</p>


You can specify default values for arguments.

    template2 $arg1="Hello" $arg2=({a: 1, b: 2})
        h1
            $arg1
        p
            (JSON.stringify($arg2))

    // $C.tpl.template2('Pillow', 'World') will produce:
    //
    //  <h1>Pillow</h1>
    //  <p>"World"</p>

    // $C.tpl.template2() will produce:
    //
    //  <h1>Hello</h1>
    //  <p>{"a":1,"b":2}</p>


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

Use CSS selector-like constructions to create tags.

    // Create <div class="test"></div>
    div.test

    // Create <a id="ppp" class="hello world" href="http://conkitty.io"></a>
    a#ppp.hello.world[href="http://conkitty.io/"]

    // Create <a href="http://conkitty.io" data-rnd="0.8223862457089126">Yo</a>
    a
        @href "http://conkitty.io/"
        @data-rnd (Math.random())
        "Yo"
    // or
    a[href="http://conkitty.io/"][data-rnd=(Math.random())]
        "Yo"

There are `:if(expr, trueSelector, falseSelector)` and `:elem(expr)` pseudo
selectors.

    template $arg1 $arg2
        strong:if($arg1, .arg1-is-true#piu, [data-something="yes"])
            "Hello"
        #identifier:elem($arg2)
            "World"

    // $C.tpl.template(true, 'em') will produce:
    //
    //  <strong class="arg1-is-true" id="piu">Hello</strong>
    //  <em id="identifier">World</em>

    // $C.tpl.template(false, 'span') will produce:
    //
    //  <strong data-something="yes">Hello</strong>
    //  <span id="identifier">World</span>

There are several ways to specify attributes:

+ `[attr=val]` parts of selectors,
+ `@attr val` below selectors,
+  `ATTR` command (see this command description below).

<!-- separate me baby -->

    template $val2 $val5
        div.class1[attr1="val1"][attr2=$val2][attr3=('val' + 3)]
            @attr4 "val4"
            @attr5 $val5
            @attr6 ('val' + 6)
            // Special case for `class` attribute, you can add, subtract and
            // use selector syntax:
            @class +.class2.class3  // Add using selector syntax.
            @class -.class2         // Subtract using selector syntax.
            @class +"class4 class5" // Add.

    // $C.tpl.template('val222', 'val555') will produce:
    //
    // <div class="class1 class3 class4 class5"
    //      attr1="val1"
    //      attr2="val222"
    //      attr3="val3"
    //      attr4="val4"
    //      attr5="val555"
    //      attr6="val6"></div>


## Variables

A number of variables could be accessible inside a template. Template
arguments, `SET`, `EACH` and `WITH` commands, `AS $var` constructions create
variables inside a template. Variable names should be a `$` sign followed by
a valid JavaScript variable name, all template variables are accessible in
template JavaScript expressions via their names.

    template $arg1 $arg2
        SET $var1 $arg1
        SET $var2 ('Concatenated ' + $arg2 + $arg2)
        $arg1
        ($var1 + ' piu ' + $arg2)
        $var2


## Commands

### ATTR *name* *value*

This command should be used to add an attribute with a dynamic name.

*name* and *value* are strings, variables or JavaScript expressions.

    // Create
    // <div id="yep"></div>
    // or
    // <div class="yep"></div>
    div
        ATTR (Math.random() < 0.5 ? 'id' : 'class') "yep"

### CALL *template-name [arg1 [arg2 […]]]*

You can call one template from another. argN are arguments for a template.
Arguments should be strings, variables or JavaScript expressions.

    template1
        div
            CALL template2 "Hello" (' wo' + 'rld')

    template2 $arg1 $arg2
        h1
            $arg1
            $arg2
            "!"

    // $C.tpl.template1() will produce:
    //
    // <div>
    //     <h1>Hello world!</h1>
    // </div>

You can pass arguments by names.

    template1
        div
            // Notice that `$` signs in argument names should not present here.
            CALL template2 "111" "22" a6=('si' + 'x') a4="ffff"

    // Say, we have a template with a bunch of arguments with default values.
    template2 $a1="1" $a2="2" $a3="3" $a4="4" $a5="5" $a6="6"
        h1
            $a1
        h2
            $a2
        h3
            $a3
        h4
            $a4
        h5
            $a5
        h6
            $a6

    // $C.tpl.template1() will produce:
    //
    // <div>
    //     <h1>111</h1>
    //     <h2>22</h2>
    //     <h3>3</h3>
    //     <h4>ffff</h4>
    //     <h5>5</h5>
    //     <h6>six</h6>
    // </div>


Additionally, you can pass a subtree when you call a template.

    template1
        div
            CALL template2 "Hello world"
                // This is PAYLOAD for template2, it will be calculated lazily
                // when (and if) you use PAYLOAD command inside template2.
                span
                    "!"

    template2 $arg1
        h1
            $arg1
            PAYLOAD

    // $C.tpl.template1() will produce:
    //
    // <div>
    //     <h1>Hello world<span>!</span></h1>
    // </div>

It is possible to get template name dynamically, as JavaScript expression.

    template1
        div
            CALL ('template' + 2) "Hello" "world"

    template2 $arg1 $arg2
        $arg1
        " "
        $arg2

You can compliment `CALL` command with `EXCEPT` section, which will be executed
in case of any exception during `CALL` command processing.

    template1
        div
            CALL template2
                // Payload could be here too.
            EXCEPT
                "Oops"

        div
            CALL (function() { throw new Error('Template name getter exception'); })
            EXCEPT
                "It is safe"

    template2
        span
            JS
                throw new Error('Exception, baby')


### CHOOSE

`CHOOSE` is a command to choose one of multiple choices.

    template $arg1
        CHOOSE
            WHEN ($arg1 === 1)
                div
                    "111"
            WHEN $arg1
                span
                    "222"
            OTHERWISE
                p
                    ($arg1 + ' aaa ' + $arg1)

    // $C.tpl.template(1) will produce: <div>111</div>.
    // $C.tpl.template(2) will produce: <span>222</span>.
    // $C.tpl.template(false) will produce: <p>false aaa false</p>.

Any number of `WHEN` sections is possible. `OTHERWISE` section is optional.

### EACH *[$key] $value* *expr*

Iterate over an array or an object.

*$key* and *$value* are references to items you're being iterating through.
They should be a `$` sign plus a valid JavaScript variable name. *$key* is
optional.

*expr* is a variable or a JavaScript expression returns an array or an object.

    template
        EACH $val ([11, 22])
            p
                ($val + ' aa ' + $val)

        EACH $index $val ([33, 44])
            span
                $index
                ": "
                $val

        EACH $vvv ({k1: 'v1', k2: 'v2'})
            div
                $vvv

        EACH $k $v ({k3: 'v3', k4: 'v4'})
            em
                $k
                ": "
                $v

    // $C.tpl.template() will produce:
    //
    // <p>11 aa 11</p>
    // <p>22 aa 22</p>
    // <span>0: 33</span>
    // <span>1: 44</span>
    // <div>v1</div>
    // <div>v2</div>
    // <em>k3: v3</em>
    // <em>k4: v4</em>

It is possible to add fallback for an empty array (or object):

    template
        ul
            EACH $val ([])
                li
                    $val
            ELSE
                li.empty
                    "No items."

        EACH $key $val ({})
            p
                $key
                ": "
                $val
        ELSE
            em
                "Empty."

### JS *[$item $index $obj]*

Run arbitrary JavaScript code.

*$item*, *$index* and *$obj* are references to current context items.

Everything that's below `JS` command with higher indentation will be executed
as JavaScript code.

    template
        div
            JS
                window.everythingIsOk = true
            p
                "Hello world"
                JS
                    var y = 'y',
                        e = 'e',
                        s = 's';
                    window.thisIsOkToo = y + e + s;

            ul
                EACH $i $v ([11, 22])
                    li
                        JS $item $index $arr
                            console.log($item === $v, $index === $i, $item, $arr);
                        $v


    // $C.tpl.template() will produce:
    //
    // <div>
    //     <p>Hello world</p>
    //     <ul>
    //         <li>11</li>
    //         <li>22</li>
    //     </ul>
    // </div>
    //
    // `window.everythingIsOk` and `window.thisIsOkToo` will be set to
    // `true` and 'yes' respectively, and there will be two lines in console
    // log: `true true 11 [11, 22]` and `true true 22 [11, 22]`.


### MEM *key* *[expr]*

You have access to exact DOM nodes during their creation process. You can
memorize some of these nodes for future use.

    template
        div
            MEM "my-div"

            p
                MEM ('my' + '-' + 'p') ({ppp: this})

    // $C.tpl.template();
    // `$C.mem` will be {'my-div': <div>, 'my-p': {'ppp': <p>}}

### SET *$name* *expr*

*$name* is a `$` sign plus a valid JavaScript variable name.

*expr* is a JavaScript expression for a variable value.

Sometimes you need to define a variable.

    template1
        div
            SET $myvar ({some: 'data', inside: '.'})

            EACH $val $myvar
                $val

            // You can reuse variable names.
            SET $myvar ({another: 'value'})

            ($myvar.another)

    // $C.tpl.template1() will produce:
    //
    // <div>data.value</div>

You can also assign a subtree to a variable.

    template2
        SET $myvar2
            em
                "hello"
            strong
                "world"

        div
            // Use unescaped JavaScript expression (see below) to insert the result.
            ((($myvar2)))

    // $C.tpl.template2() will produce:
    //
    // <div>
    //     <em>hello</em>
    //     <strong>world</strong>
    // </div>


### TEST *expr*

`TEST` is a simplified `CHOOSE` for the cases you have only one option to check.

    template $title
        TEST $title
            h1
                $title
        p
            "Some content"

    // $C.tpl.template('Tiiiiiii') will produce:
    //
    // <h1>Tiiiiiii</h1>
    // <p>Some content</p>

    // $C.tpl.template() will produce:
    //
    // <p>Some content</p>


### TRIGGER *[arg1 [arg2 […]]]*

You can subscribe to `TRIGGER` command calls from your application:

    $C.on(function(arg1, arg2) {
        // `this` will be currently created DOM element.
        console.log(arg1, arg2, this);
    });

After that:

    template
        div
            TRIGGER "some" ({arg: true})
            "Hello"

    // Calling $C.tpl.template.call(document.body) will add `<div>Hello</div>`
    // to `document.body` and print `some {arg: true} <div>Hello</div>` in your
    // console log.


### WITH *$name* *expr*

*$name* is a `$` sign plus a valid JavaScript variable name.

*expr* is a JavaScript expression.

    template
        div
            SET $v ({a: {b: {c: 'd', e: false}}})

            div
                WITH $ok ($v.a.b.c)
                    $ok
                ELSE
                    "HECK"

            div
                // Go to ELSE section in case of exception.
                WITH $ok ($v.e.f.g)
                    $ok
                ELSE
                    "HECK"

            div
                WITH $ok ($v.a.b.e)
                    $ok
                ELSE
                    "HECK"

            div
                // Go to ELSE section in case of undefined value.
                WITH $ok ($v.a.b.no)
                    $ok
                ELSE
                    "HECK"

    // $C.tpl.template() will produce:
    //
    // <div>
    //     <div>d</div>
    //     <div>HECK</div>
    //     <div>false</div>
    //     <div>HECK</div>
    // </div>


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

    template3 $arg
        "This is not "

        $arg

        ", this is "

        ((($arg)))

        " indeed."

    // $C.tpl.template1() will produce:
    //
    // <div>
    //     <p>
    //         This is not [object DocumentFragment], this is <span>some DOM inside</span> indeed.
    //     </p>
    //     &lt;em&gt;no, it is not&lt;/em&gt;
    //     <strong>yes, it is</strong>
    // </div>


## Line wrap

Templates can accept many arguments, selectors could be pretty long. It is
possible to split command into several lines. When parser meets `\`, it skips
all the whitespaces after and continues with first non-whitespace character.

    template1
        CALL template2  \
            "Argument1" \
            "Argument2" \
            "Argument3"

    template2 $arg1 $arg2 $arg3
        div.class1\
                  [attr1=$arg1]\
                  [attr2=$arg2]\
                  [attr3=$arg3]
            "Hello"

    // $C.tpl.template1() will produce:
    //
    // <div class="class1" attr1="Argument1" attr2="Argument2" attr3="Argument3">Hello</div>


## Namespaced templates

When you build a set of files, all the templates go to compiled result.
But you can declare namespaced templates, they will go to the result only in
case they are used from regular templates.

Namespaced templates can be called from regular templates and can't be called
directly using `$C.tpl[name]` functions.

    // Regular template, will go to the result anyway.
    template
        div
            CALL ns1::template1 "World"

            // You can skip `CALL` keyword when you call namespaced template:
            ns1::template1 "Pillow"

    // Namespaced template, will go to the result because it's used from regular template above.
    ns1::template1 $arg
        span
            "Hello "
            $arg

    // Another namespaced template, will not appear in the result since it's not used.
    another-ns::template1
        strong
            "No way"

    // $C.tpl.template() will produce:
    //
    // <div>
    //     <span>Hello World</span>
    //     <span>Hello Pillow</span>
    // </div>

It is possible to skip `CALL` keyword, when you call namespaced templates.


## Remembering created nodes

Conkitty is a DOM generator, not a string generator. As a benefit, you have an
access to exact DOM nodes during their creation process. You can push these
nodes back to your application using `TRIGGER` and `MEM` commands. But you also
can assign nodes to variables with `AS $varName` constructions.

    template
        div
            span.hello AS $mySpan
            em.world AS $world

        // Now you have `<span>` in `$mySpan` and `<em>` in `$world`.
        // You can pass them to other templates or do something sophisticated with them.
        JS
            $mySpan.innerHTML = 'Hello';
            $world.innerHTML = ' beautiful world';

    // $C.tpl.template() will produce:
    //
    // <div>
    //     <span class="hello">Hello</span>
    //     <em class="world"> beautiful world</em>
    // </div>


## Returning more from templates

You can return complex structures from templates, this is useful when you
create reusable components (for example, you can return component's API).

Use `EXPOSE` command in combination with string, variable, expression or
`JS` command to return value and `AS $varName` construction to get returned
value.

    template
        div
            // $btn will have `{btn: <button>, title: <span>}`
            ctrl::button "My sweet button" AS $btn

            JS
                $btn.title.innerHTML += '!!!';

    ctrl::button $title $type="button"
        button[type=$type] AS $btnNode
            span AS $titleNode
                $title

        EXPOSE ({btn: $btnNode, title: $titleNode})

        // Or the same with `JS` command:
        //
        // EXPOSE JS
        //     return {btn: $btnNode, title: $titleNode}
        //
        // Or the same with variable:
        //
        // SET $ret ({btn: $btnNode, title: $titleNode})
        // EXPOSE $ret

    // $C.tpl.template() will produce:
    //
    // <div>
    //     <button type="button">
    //         <span>My sweet button!!!</span>
    //     </button>
    // </div>

Only one `EXPOSE` command per template is allowed.

You can return values from regular templates too and have them as the result
of template function call.

    template1
        div
            "Hello World"

    template2
        div AS $d
            "Hello World"
        EXPOSE ({elem: $d, ololo: 'something else'})

Feel the difference in calls below.

```js
var ret;

ret = $C.tpl.template1();
// `ret` is a document fragment with `<div>Hello World</div>` inside.

ret = $C.tpl.template1.call(document.body);
// `ret` is undefined and `<div>Hello World</div>` is added to `<body>`.

ret = $C.tpl.template2();
// `ret` is `{elem: <div>, ololo: 'something else'}`.

ret = $C.tpl.template2.call(document.body);
// `ret` is `{elem: <div>, ololo: 'something else'}` and
// `<div>Hello World</div>` is added to `<body>`.
```


## Node appender

If you have DOM node in a variable (or as an expression result), you can use
Conkitty syntax to modify attributes and add children to this node. Use `^`
operator for this.

    template1
        div.hello AS $myDiv
            CALL template2 $myDiv

        div.world AS $myDiv2
        CALL template2 $myDiv2

    template2 $div
        strong
            "Yo"

        // Manipulations with $div node.
        TEST $div
            ^$div
                @class +.class1.class2
                span
                    "Hello"

        em
            "Yep"

    // $C.tpl.template1() will produce (notice node order):
    //
    // <div class="hello class1 class2">
    //     <span>Hello</span>
    //     <strong>Yo</strong>
    //     <em>Yep</em>
    // </div>
    // <div class="hello class1 class2">
    //     <span>Hello</span>
    // </div>
    // <strong>Yo</strong>
    // <em>Yep</em>


## External files dependency declaration

It often happens that you need some additional dependencies for your
templates (such as stylesheets, JavaScript files or images).

It is possible to declare these dependencies and have their properly ordered
list along with compiled templates. Use `&` operator for this.

Say, you have `tpl.ctpl` file like this:

    template
        &"file1.css"
        &"file1.js"
        div
            ctrl::button "My button"

    // You can declare namespace-wide dependencies (they will go to the result
    // in case any template of this namespace is used in regular templates).
    ctrl::
        &"ctrl.css"
        &"ctrl.js"

    ctrl::button $title $type="button"
        &"button.css"
        button[type=$type]
            $title

    // Will not appear in the result since not used.
    ctrl::input $name
        &"input.css"
        input[type="text"][name=$name]

    // Will not appear in the result since not used.
    aaa::
        &"aaa.css"

    // Will not appear in the result since not used.
    aaa::template
        &"aaa.js"

`conkitty` command line tool has `--deps` option, it means filename to put
dependencies list to. [grunt-conkitty](https://github.com/hoho/grunt-conkitty)
has `deps` option too, for Grunt plugin it means directory to copy all the
dependencies to.

Let's use command line tool like
`conkitty --common=common.js --templates=tpl.js --deps=deps.txt tpl.ctpl`

`deps.txt` will be:

    /absolute/path/to/ctrl.css
    /absolute/path/to/ctrl.js
    /absolute/path/to/button.css
    /absolute/path/to/file1.css
    /absolute/path/to/file1.js


## Precompile expressions

Precompile expressions are a kind of black voodoo and should be used in
exceptional cases only.

Precompile expressions are JavaScript expressions that are evaluated by
template parser. Precompile expression should start with `|(` and end with `)|`.

For example, we have a template like this:

    template|('-suffix' + prop1)|
        &|('"style.' + prop2 + '.css"')|
        p|(prop3 ? '.class1' : '')|
            "Hello"

In this example `prop1`, `prop2` and `prop3` are keys of environment object
passed to `Conkitty` constructor. Here is the actual template that will be
compiled if we pass environment object like
`{prop1: 111, prop2: 'dark', prop3: true}`:

    template-suffix111
        &"style.dark.css"
        p.class1
            "Hello"


## Generated code notes

Generated code for a template like:

    b-checkbox $props
        div.checkbox
            label
                input[type="checkbox"][name=($props.name)][id=($props.id)][value=($props.value)]
                TEST ($props.label)
                    em
                        ($props.label)

will look like:

    $C.tpl["b-checkbox"] = function($props) {
        var $ConkittyEnv = $ConkittyGetEnv(this);
        return $C($ConkittyEnv.p)
            .div({"class": "checkbox"})
                .elem("label")
                    .elem("input", function $C_b_checkbox_4_13(){return{type:"checkbox",name:$props.name,id:$props.id,value:$props.value}})
                    .end()
                    .test(function $C_b_checkbox_5_18() { return ($props.label); })
                        .elem("em")
                            .text(function $C_b_checkbox_7_21() { return ($props.label); })
        .end(5);
    };

You might notice anonymous functions named like `$C_b_checkbox_7_21`. These
names are for easier debugging — you'll see template name, line number and
character position in your call stack. JavaScript minifiers like UglifyJS
remove these names during minification, so, compiled templates minify really
well.

## Source maps

Since version `0.5.7`, Conkitty is capable of creating source maps for compiled
templates.

Check out [gulp-conkitty](https://github.com/hoho/gulp-conkitty) and
[grunt-conkitty](https://github.com/hoho/grunt-conkitty) to see how to
create source maps.

Or use `--sourcemap` argument of command line utility:

    conkitty --common=common.js --templates=tpl.js --sourcemap=tpl.map tpl.ctpl

When you compile templates with source map, `//# sourceMappingURL=your.source.map`
comment is being added on top of your compiled templates code.


## Performance notes

It is hard to do adequate performance tests. I did simple ones like (simplified
example):

```js
function render(parent, arr) {
    var ret,
        i;

    ret = '<ul>';

    for (i = 0; i < arr.length; i++) {
        ret += '<li>' + arr[i] + '</li>';
    }

    ret += '</ul>';

    parent.innerHTML = ret;
}

render(document.body, [1, 2, 3, 4, 5])
```

versus template:

    render $arr
        ul
            EACH $item $arr
                li
                    $item

and template call:

```js
$C.tpl.render.call(document.body, [1, 2, 3, 4, 5])
```

And first ones were about 50% faster. But there are at least three things to
keep in mind:

+ After you've built DOM from HTML string, you need to spend some time
  traversing this DOM to find all key nodes your application needs. With
  Conkitty you don't need DOM traversals — you have access to exact DOM nodes
  during template execution.
+ Pages are mostly reasonably-sized. This means that even bigger performance
  difference will not have noticeable impact to application speed.
+ Many optimizations could be done in future (like merging adjacent text node
  generators into single expression). But because of first two things I clarify
  these optimizations as premature.
