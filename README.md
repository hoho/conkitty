Conkitty Template Engine
========================

Conkitty templates are being compiled to
[concat.js](https://github.com/hoho/concat.js) chains.

## Quick start

Two quick start options are available:

* `npm install -g conkitty` and `conkitty file.ctpl` will print compiled
  `file.ctpl` file.
* Use [grunt-contrib-conkitty](https://github.com/hoho/grunt-contrib-conkitty)
  to build Conkitty templates with [Grunt](http://gruntjs.com/)

To start using compiled templates:

* Link [concat.js](https://github.com/hoho/concat.js) to your page;
* link [callTemplate](https://github.com/hoho/conkitty/blob/master/callTemplate/conkittyCallTemplate.js)
  function to your page;
* link compiled templates to your page.

You can install all of these from [Bower](http://bower.io) or [npm](http://npmjs.org/)
repositories.

```html
<html>
    <head>
        <title>Hello</title>
    </head>
    <body>
        <script src="https://rawgithub.com/hoho/concat.js/master/concat.min.js"></script>
        <script src="https://rawgithub.com/hoho/conkitty/master/callTemplate/conkittyCallTemplate.js"></script>
        <script src="/path/to/compiled/templates"></script>
        <script>
            // Insert `template-name` into document body right away.
            $C.callTemplate(document.body, 'template-name', 'Hello', [1, 2, 3], {k1: 'v1', k2: 'v2'});
        </script>
    </body>
</html>
```

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
template via appropriate names.

## Strings

Strings are enclosed in single or double quotes. String should begin and end
in the same line. String output will be properly escaped in resulting DOM.

**Good**

    "Hello world"

    'Hello \'world\''

    "Hello <world>"

**Bad**

    "Hello
       world"

## Unescaped strings

A string like `"&nbsp;"` will produce `&amp;nbsp;` in resulting DOM. To put
unescaped text to resulting DOM, enclose string in triple quotes. Note that
markup inside triple quotes should be valid.

**Good**

    """Hello&nbsp;world"""

    '''<p>Hello <strong>world</strong></p>'''

**Bad**

    """</div>"""

## JavaScript expressions

JavaScript expressions are enclosed in parenthesis. JavaScript expressions
should return some result. This result will be inserted in resulting DOM.
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

Pending.

### EACH

Pending.

### INSERT

Pending.

### MEM

Pending.

### SET

Pending.

### TEST

Pending.

### WITH

Pending.


# Example

## Below is the template example

    page title data
        TEST (title)
            h1#identifier.some-class[aaa=bbb]%b-block1{mod=val}
                (title)
        p.ccc
            CHOOSE
                WHEN (data.isUL)
                    CALL ul_list (data.list)
                        h3
                            "This is <UL>"
                WHEN (data.isOL)
                    CALL ol_list (data.list) (1 + 3)
                OTHERWISE
                    em
                        "Nothing"

    ul_list items
        div[data-list=999]
            PAYLOAD
        ul
            CALL list (items)

    ol_list items arg1
        h3
            "arg1 + 1 === "
            (arg1 + 1)
        ol
            CALL list (items)

    list items
        EACH cur (items)
            li.item
                @num (cur)
                "item: "
                strong
                    (cur)
                    "!"

    sep
        section.horizontal-separator
            "sep-sep-sep"


## Here is the JavaScript to run

```js
// Calling template with different input.
$('body')
    .$C('page', 'This is page', {})
    .$C('sep')
    .$C('page', null, {list: [11, 22, 33], isUL: true})
    .$C('sep')
    .$C('page', null, {list: ['aa', 'bb'], isOL: true});
```

http://rawgithub.com/hoho/conkitty/master/example.html

## And the result inserted in `<body>` tag

```html
<h1 id="identifier" aaa="bbb" class="some-class b-block1 b-block1_mod_val">This is page</h1>
<p class="ccc">
    <em>Nothing</em>
</p>
<section class="horizontal-separator">sep-sep-sep</section>
<p class="ccc">
    <div data-list="999">
        <h3>This is &lt;UL&gt;</h3>
    </div>
    <ul>
        <li class="item" num="11">item: <strong>11!</strong></li>
        <li class="item" num="22">item: <strong>22!</strong></li>
        <li class="item" num="33">item: <strong>33!</strong></li>
    </ul>
</p>
<section class="horizontal-separator">sep-sep-sep</section>
<p class="ccc">
    <h3>arg1 + 1 === 5</h3>
    <ol>
        <li class="item" num="aa">item: <strong>aa!</strong></li>
        <li class="item" num="bb">item: <strong>bb!</strong></li>
    </ol>
</p>
```
