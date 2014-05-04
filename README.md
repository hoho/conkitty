# Conkitty Template Engine [![Build Status](https://travis-ci.org/hoho/conkitty.svg?branch=master)](https://travis-ci.org/hoho/conkitty)

Conkitty templates are being compiled to
[concat.js](https://github.com/hoho/concat.js) chains.


## Quick start

Two quick start options are available:

* `npm install -g conkitty` and `conkitty -c common.js -t tpl.js file.ctpl`
  will compile `file.ctpl` to `common.js` and `tpl.js` files.
* Use [grunt-conkitty](https://github.com/hoho/grunt-conkitty)
  to build Conkitty templates with [Grunt](http://gruntjs.com/).

Compiled templates consist of two parts:

* Common core code needed for runtime;
* compiled templates code.

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

Check out [this example](https://github.com/hoho/conkitty/tree/master/example).

# Syntax (description is in painful progress)

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
template via appropriate names. Argument names should be a valid JavaScript
variable names.

    template1 $arg1 $arg2
        h1
            $arg1
        p
            (arg2 + ' ' + arg2) // JavaScript expression.

    // $C.tpl.template1('Hello', 'World') will produce:
    //
    //  <h1>Hello</h1>
    //  <p>World World</p>


You can specify default values for arguments.

    template2 $arg1["Hello"] $arg2[({a: 1, b: 2})]
        h1
            $arg1
        p
            (JSON.stringify(arg2))

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

    // Create <a href="http://xslc.org/" data-rnd="0.8223862457089126">Yo</a>
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

As you could notice, there are several ways to specify attributes:

+ `[attr=val]` parts of selectors,
  expressions,
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
            @class -.class2         // Subtract.
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


## Commands

### ATTR *name* *value*

This command should be used to add an attribute with a dynamic name.

*name* and *value* are strings, variables or JavaScript expressions.

    // Create <div id="yep"></div> or <div class="yep"></div>
    div
        ATTR (Math.random() < 0.5 ? 'id' : 'class') "yep"

### CALL *template-name [arg1 [arg2 […]]]*

You can call one template from another. argN are arguments for a template.

    // Calling template1 will create <div><h1>Hello world!</h1></div>
    template1
        div
            CALL template2 "Hello" (' wo' + 'rld')

    template2 $arg1 $arg2
        h1
            $arg1
            $arg2
            "!"

You can pass arguments by names.

    // Calling template1 will create:
    //     <div>
    //         <h1>111</h1>
    //         <h2>22</h2>
    //         <h3>3</h3>
    //         <h4>ffff</h4>
    //         <h5>5</h5>
    //         <h6>six</h6>
    //     </div>

    template1
        div
            CALL template2 "111" "22" a6[('si' + 'x')] a4["ffff"]

    // Say, we have a template with a bunch of arguments with default values.
    template2 $a1["1"] $a2["2"] $a3["3"] $a4["4"] $a5["5"] $a6["6"]
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

Additionally, you can pass a subtree when you call a template.

    // Calling template1 will create <div><h1>Hello world<span>!</span></h1></div>
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

It is possible to get template name as JavaScript expression.

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
            WHEN (arg1 === 1)
                div
                    "111"
            WHEN $arg1
                span
                    "222"
            OTHERWISE
                p
                    (arg1 + ' aaa ' + arg1)

    // $C.tpl.template(1) will produce: <div>111</div>.
    // $C.tpl.template(2) will produce: <span>222</span>.
    // $C.tpl.template(false) will produce: <p>false aaa false</p>.

Any number of `WHEN` sections is possible. `OTHERWISE` is an optional section.

### EACH *[$key] $value* *expr*

Iterate over an array or an object.

*$key* and *$value* are references to items you're being iterating through.
They should be a `$` sign plus a valid JavaScript variable name. *$key* is
optional.

*expr* is a variable or a JavaScript expression returns an array or an object.

    template
        EACH $val ([11, 22])
            p
                (val + ' aa ' + val)

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
                            console.log(item === v, index === i, item, arr);
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

You have an access to exact DOM nodes during their creation process. You can
memorize some of these nodes for future use.

    template
        div
            MEM "my-div"

            p
                MEM ('my' + '-' + 'p') ({ppp: this})

    // $C.tpl.template();
    // `$C.mem` will be {'my-div': div, 'my-p': {'ppp': p}}

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

            (myvar.another)

    // This template will produce:
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
            (((myvar2)))

    // This template will produce:
    // <div><em>hello</em><strong>world</strong></div>


### TEST *expr*

`TEST` is a simplified `CHOOSE` for the cases you have only one option to check.

    template $title
        TEST $title
            h1
                $title
        p
            "Some content"

    // $C.tpl.template('Tiiiiiii') will produce:
    // <h1>Tiiiiiii</h1><p>Some content</p>

    // $C.tpl.template() will produce:
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
                WITH $ok (v.a.b.c)
                    $ok
                ELSE
                    "FUCK"

            div
                // Go to ELSE section in case of exception.
                WITH $ok (v.e.f.g)
                    $ok
                ELSE
                    "FUCK"

            div
                WITH $ok (v.a.b.e)
                    $ok
                ELSE
                    "FUCK"

            div
                // Go to ELSE section in case of undefined value.
                WITH $ok (v.a.b.no)
                    $ok
                ELSE
                    "FUCK"

    // This template will produce:
    //
    // <div>
    //     <div>d</div>
    //     <div>FUCK</div>
    //     <div>false</div>
    //     <div>FUCK</div>
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


## Namespaced templates


## Remembering created nodes and template call results


## Returning more from templates


## Node appender


## External files dependency declaration


## Generated code notes

Generated code for a template like:

    b-checkbox $props
        div.checkbox
            label
                input[type="checkbox"][name=(props.name)][id=(props.id)][value=(props.value)]
                TEST (props.label)
                    em
                        (props.label)

will look like:

    $C.tpl["b-checkbox"] = function(props) {
        var $ConkittyEnv = $ConkittyGetEnv(this);
        return $C($ConkittyEnv.p)
            .div({"class": "checkbox"})
                .elem("label")
                    .elem("input", function $C_b_checkbox_4_13(){return{type:"checkbox",name:props.name,id:props.id,value:props.value}})
                    .end()
                    .test(function $C_b_checkbox_5_18() { return (props.label); })
                        .elem("em")
                            .text(function $C_b_checkbox_7_21() { return (props.label); })
        .end(5);
    };

You might notice anonymous functions named like `$C_b_checkbox_7_22`. These
names are for easier debugging — you'll see template name, line number and
character position in your call stack. JavaScript minifiers like UglifyJS
remove these names during minification, so, compiled templates minify really
well.
