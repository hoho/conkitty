conkitty
========

Concat.js Template Engine

Not ready yet.

# Example

In this example templates are being compiled at the runtime. In production it is
supposed to have compiled concat.js chains only.

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
        EACH (items)
            li.item
                @num CURRENT
                "item: "
                strong
                    CURRENT
                    "!"

    sep
        section.horizontal-separator
            "sep-sep-sep"


## Here is the JavaScript to run

    // Calling template with different input.
    $('body')
        .$C('page', 'This is page', {})
        .$C('sep')
        .$C('page', null, {list: [11, 22, 33], isUL: true})
        .$C('sep')
        .$C('page', null, {list: ['aa', 'bb'], isOL: true});

http://rawgithub.com/hoho/conkitty/master/example.html

## And the result inserted into `<body>` tag

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

## Template above is compiled to concat.js chains like these:

    {
        page: function (_, title, data) {
            return $C(_.parent)
                .test(function() { return (title); })
                    .elem('h1', {"id":"identifier","aaa":"bbb","class":"some-class b-block1 b-block1_mod_val"})
                        .text(function() { return (title); })
                .end(2)
                .p({"class":"ccc"})
                    .choose()
                        .when(function() { return (data.isUL); })
                            .act(function() {
                                $C.tpl.ul_list({parent: this, payload:
                                    $C()
                                        .elem('h3')
                                            .text("This is <UL>")
                                    .end(2)[0]},
                                    (data.list)
                                );
                            })
                        .end()
                        .when(function() { return (data.isOL); })
                            .act(function() {
                                $C.tpl.ol_list({parent: this},
                                    (data.list),
                                    (1 + 3)
                                );
                            })
                        .end()
                        .otherwise()
                            .elem('em')
                                .text("Nothing")
            .end(5)
        },

        ul_list: function (_, items) {
            return $C(_.parent)
                .div({"data-list":"999"})
                    .act(function() { if (_.payload) { this.appendChild(_.payload); }})
                .end()
                .ul()
                    .act(function() {
                        $C.tpl.list({parent: this},
                            (items)
                        );
                    })
            .end(2)
        },

        ol_list: function (_, items, arg1) {
            return $C(_.parent)
                .elem('h3')
                    .text("arg1 + 1 === ")
                    .text(function() { return (arg1 + 1); })
                .end()
                .ol()
                    .act(function() {
                        $C.tpl.list({parent: this},
                            (items)
                        );
                    })
            .end(2)
        },

        list: function (_, items) {
            return $C(_.parent)
                .each(function() { return (items); })
                    .li({"class":"item"})
                        .attr('num', function() { return arguments[0]; })
                        .text("item: ")
                        .elem('strong')
                            .text(function(item) { return item; })
                            .text("!")
            .end(4)
        },

        sep: function (_) {
            return $C(_.parent)
                .elem('section', {"class":"horizontal-separator"})
                    .text("sep-sep-sep")
            .end(2)
        }
    }
