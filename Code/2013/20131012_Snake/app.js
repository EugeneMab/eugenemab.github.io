var Snake;
(function (Snake) {
    (function (Program) {
        var contentDiv;
        function reset() {
            this.contentDiv = document.getElementById("content");
            this.contentDiv.innerHTML = "Hello";
        }
        Program.reset = reset;
    })(Snake.Program || (Snake.Program = {}));
    var Program = Snake.Program;
    (function (Ctrl) {
        var Program = Snake.Program;
        function onLoad() {
            Program.reset();
        }
        Ctrl.onLoad = onLoad;
    })(Snake.Ctrl || (Snake.Ctrl = {}));
    var Ctrl = Snake.Ctrl;
})(Snake || (Snake = {}));

window.onload = function () {
    Snake.Ctrl.onLoad();
};
//# sourceMappingURL=app.js.map
