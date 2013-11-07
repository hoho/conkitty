conkitty
========

Concat.js Template Engine

Conkitty templates are being compiled to https://github.com/hoho/concat.js
chains.

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

## And the result inserted into `<body>` tag

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
