function EnvClass(parent, payload) {
    this.parent = parent;
    this.payload = payload;
}

EnvClass.prototype.p = function getPayload(parent) {
    var self = this,
        ret;

    if (self.payload) {
        // Trying to get cached payload.
        if (!((ret = self._p))) {
            ret = self._p = self.payload();
        }

        if (!parent) {
            return ret.firstChild ? ret : undefined;
        }

        ret && parent.appendChild(ret);
        delete self._p;
    }
};

function getEnv(obj) {
    return obj instanceof EnvClass ? obj : new EnvClass();
}

function joinClasses() {
    var i, ret = [], arg;
    for (i = 0; i < arguments.length; i++) {
        if ((arg = arguments[i])) { ret.push(arg); }
    }
    return ret.length ? ret.join(' ') : undefined;
}

function getModClass(name, val) {
    if (val) { return val === true ? name : name + '_' + val; }
}
