(function($C, $ConkittyEnvClass, $ConkittyGetEnv, $ConkittyClasses, $ConkittyMod, $ConkittyChange, undefined) {

$C.tpl["page"] = function() {
    var $ConkittyEnv = $ConkittyGetEnv(this);
    return $C($ConkittyEnv.p)
        .elem("h1")
            .text("This is Conkitty demo")
        .end()
        .p()
            .text("It ")
            .elem("em")
                .text("is")
            .end()
            .text(" really ")
            .elem("strong")
                .text("nice")
            .end()
            .text(".")
        .end()
        .elem("footer")
            .text("Here goes some ")
            .act(function() {
                $C._tpl["blocks::button"].call(new $ConkittyEnvClass(this), "BUTTON");
            })
    .end(2);
};

$C._tpl["blocks::button"] = function($title, $type) {
    ($type === undefined) && ($type = "button");
    var $ConkittyEnv = $ConkittyGetEnv(this), $ConkittyTemplateRet, $btn;
    $C($ConkittyEnv.p)
        .elem("button", function $C_button_5_5(){return{"class":"blocks-button",type:$type}})
            .act(function() { $btn = this; })
            .text(function $C_button_6_9() { return $title; })
        .end()
        .act(function() { $ConkittyTemplateRet = (new Blocks.Button($btn)); })
    .end();
    return $ConkittyTemplateRet;
};

}).apply(null, $C._$args);